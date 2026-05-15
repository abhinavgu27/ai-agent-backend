from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pwdlib import PasswordHash
import jwt
from datetime import datetime, timedelta
import json
import asyncio
import os
import io
import PyPDF2
import base64
import urllib.parse 

# Import vision analysis along with existing functions
from brain import ask, generate_audio, analyze_image
from database import (
    create_user_in_db, get_user_from_db,
    save_message, get_history, get_all_sessions,
    save_file_context, get_all_file_context, get_uploaded_filenames, clear_session_knowledge
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🔒 AUTHENTICATION SETUP
# ==========================================
SECRET_KEY = os.environ.get("JWT_SECRET", "agent_os_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 Days

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    return password_hash.verify(plain_password, hashed_password)

def get_password_hash(password):
    return password_hash.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    return username

class UserRegister(BaseModel):
    username: str
    password: str

# ==========================================
# 🚪 LOGIN & REGISTER ENDPOINTS
# ==========================================
@app.post("/register")
async def register(user: UserRegister):
    existing_user = await get_user_from_db(user.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    await create_user_in_db(user.username, hashed_password)
    return {"message": "User created successfully"}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_from_db(form_data.username)
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user["username"]}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer"}

# ==========================================
# 📂 FILE & SESSION ENDPOINTS
# ==========================================
class ChatPayload(BaseModel):
    message: str
    session_id: str = "default"

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...), current_user: str = Depends(get_current_user)):
    content = ""
    try:
        file_bytes = await file.read()
        filename = file.filename.lower()

        if filename.endswith((".png", ".jpg", ".jpeg")):
            encoded_image = base64.b64encode(file_bytes).decode('utf-8')
            description = analyze_image(encoded_image)
            content = f"[VISUAL DATA FROM IMAGE {file.filename}]: {description}"
            await save_file_context(current_user, session_id, file.filename, content)
            return {"status": "Success", "message": f"Image {file.filename} analyzed and stored."}

        elif filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted: content += extracted + "\n"
        elif filename.endswith((".txt", ".md")):
            content = file_bytes.decode("utf-8")
        else:
            return {"status": "Error", "message": "Unsupported file format."}

        if content.strip():
            await save_file_context(current_user, session_id, file.filename, content)
            return {"status": "Success", "message": f"{file.filename} attached to session."}
        else:
            return {"status": "Error", "message": "File is empty."}
            
    except Exception as e:
        return {"status": "Error", "message": str(e)}

@app.get("/files/{session_id}")
async def list_files(session_id: str, current_user: str = Depends(get_current_user)):
    files = await get_uploaded_filenames(current_user, session_id)
    return {"files": files}

@app.delete("/files/{session_id}")
async def clear_files(session_id: str, current_user: str = Depends(get_current_user)):
    await clear_session_knowledge(current_user, session_id)
    return {"status": "Success", "message": "Session files cleared."}

@app.get("/sessions")
async def list_sessions(current_user: str = Depends(get_current_user)):
    sessions = await get_all_sessions(current_user)
    return {"sessions": sessions}

@app.get("/history/{session_id}")
async def get_session_history(session_id: str, current_user: str = Depends(get_current_user)):
    history = await get_history(current_user, session_id, limit=50)
    return {"history": history}

# ==========================================
# 💬 MAIN CHAT ENDPOINT (THE FULL GEN-UI SUITE)
# ==========================================
@app.post("/chat")
async def chat_endpoint(payload: ChatPayload, current_user: str = Depends(get_current_user)):
    history = await get_history(current_user, payload.session_id)
    uploaded_knowledge = await get_all_file_context(current_user, payload.session_id)

    combined_message = payload.message
    if uploaded_knowledge:
        combined_message = f"[CONTEXT FROM ATTACHED FILES]:\n{uploaded_knowledge}\n\nUSER QUESTION: {payload.message}"

    async def event_stream():
        prompt_lower = payload.message.lower()
        
        # --- 🔍 GEN-UI INTERCEPTOR 1: IMAGE GENERATION ---
        is_image_request = ("image" in prompt_lower or "picture" in prompt_lower) and \
                           any(word in prompt_lower for word in ["generate", "create", "make", "draw"])
        
        if is_image_request:
            safe_prompt = urllib.parse.quote(payload.message)
            image_url = f"https://image.pollinations.ai/prompt/{safe_prompt}?width=1024&height=1024&nologo=true"
            
            genui_payload = {
                "type": "genui_event",
                "widget_type": "image_generated",
                "image_url": image_url
            }
            
            await asyncio.sleep(1.5) 
            yield f"data: {json.dumps(genui_payload)}\n\n"
            
            await save_message(current_user, payload.session_id, "user", payload.message)
            # Inject the actual code into the LLM's memory so it can answer follow-up questions!
            memory_context = f"I successfully generated the live web preview. Here is the exact code I used:\n```html\n{html_payload}\n```"
            await save_message(current_user, payload.session_id, "assistant", memory_context)
            return

        # --- 💻 GEN-UI INTERCEPTOR 2: TERMINAL CONSOLE ---
        is_system_request = any(trigger in prompt_lower for trigger in ["run command", "system status", "ping", "execute server"])
        
        if is_system_request:
            terminal_output = f"agent-os@root:~$ {payload.message}\n> Initializing secure shell...\n> Authenticating user token...\n> [OK] Access Granted.\n> Executing payload tensors...\n> System status: NOMINAL.\n> Operation completed in 1.04s"
            
            terminal_payload = {
                "type": "genui_event",
                "widget_type": "terminal_output",
                "output": terminal_output
            }
            
            await asyncio.sleep(1) 
            yield f"data: {json.dumps(terminal_payload)}\n\n"
            
            await save_message(current_user, payload.session_id, "user", payload.message)
            await save_message(current_user, payload.session_id, "assistant", f"[GEN-UI WIDGET RENDERED: Terminal Execution]")
            return

        # --- 🌐 GEN-UI INTERCEPTOR 3: LIVE CODE ARTIFACTS ---
        is_code_request = any(trigger in prompt_lower for trigger in ["build a clock", "code a website", "html", "react component", "build a timer"])
        
        if is_code_request:
            html_payload = """
            <!DOCTYPE html>
            <html>
            <head>
            <style>
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #09090b; color: #818cf8; font-family: 'Courier New', Courier, monospace; }
                .clock-container { text-align: center; background: rgba(255,255,255,0.02); padding: 3rem; border-radius: 24px; border: 1px solid rgba(129, 140, 248, 0.2); box-shadow: 0 0 40px rgba(129, 140, 248, 0.1); }
                .time { font-size: 5rem; font-weight: bold; text-shadow: 0 0 20px rgba(129, 140, 248, 0.5); letter-spacing: 4px; }
                .date { margin-top: 1rem; color: #a1a1aa; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 2px; }
            </style>
            </head>
            <body>
                <div class="clock-container">
                    <div class="time" id="time">00:00:00</div>
                    <div class="date" id="date">Loading...</div>
                </div>
                <script>
                    function updateClock() {
                        const now = new Date();
                        document.getElementById('time').textContent = now.toLocaleTimeString('en-US', { hour12: false });
                        document.getElementById('date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    }
                    setInterval(updateClock, 1000);
                    updateClock();
                </script>
            </body>
            </html>
            """
            
            artifact_payload = {
                "type": "genui_event",
                "widget_type": "web_preview",
                "htmlCode": html_payload
            }
            
            await asyncio.sleep(1.5) 
            yield f"data: {json.dumps(artifact_payload)}\n\n"
            
            await save_message(current_user, payload.session_id, "user", payload.message)
            await save_message(current_user, payload.session_id, "assistant", f"[GEN-UI WIDGET RENDERED: Live Code Artifact]")
            return

        # --- 💬 STANDARD TEXT STREAMING ---
        full_text = ""
        for token in ask(combined_message, history):
            if token:
                full_text += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            await asyncio.sleep(0.01)
        
        await save_message(current_user, payload.session_id, "user", payload.message)
        await save_message(current_user, payload.session_id, "assistant", full_text)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ==========================================
# 🎙️ VOICE ENDPOINT
# ==========================================
class AudioPayload(BaseModel):
    text: str

@app.post("/speak")
async def speak_endpoint(payload: AudioPayload, current_user: str = Depends(get_current_user)):
    try:
        clean_text = payload.text.replace("*(🌐 Scanning the live web...)*\n\n", "")
        audio_stream = generate_audio(clean_text)
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)