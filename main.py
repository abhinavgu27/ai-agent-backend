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
# 📂 FILE & SESSION ENDPOINTS (UPGRADED FOR VISION)
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

        # --- 👁️ NEW: VISION PROCESSING ---
        if filename.endswith((".png", ".jpg", ".jpeg")):
            # Convert to Base64
            encoded_image = base64.b64encode(file_bytes).decode('utf-8')
            
            # Analyze image using Llama-3.2-Vision
            description = analyze_image(encoded_image)
            
            # Wrap description as context
            content = f"[VISUAL DATA FROM IMAGE {file.filename}]: {description}"
            await save_file_context(current_user, session_id, file.filename, content)
            return {"status": "Success", "message": f"Image {file.filename} analyzed and stored."}

        # --- EXISTING: PDF/TEXT PROCESSING ---
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
# 💬 MAIN CHAT ENDPOINT (PROTECTED)
# ==========================================
@app.post("/chat")
async def chat_endpoint(payload: ChatPayload, current_user: str = Depends(get_current_user)):
    history = await get_history(current_user, payload.session_id)
    uploaded_knowledge = await get_all_file_context(current_user, payload.session_id)

    combined_message = payload.message
    if uploaded_knowledge:
        combined_message = f"[CONTEXT FROM ATTACHED FILES]:\n{uploaded_knowledge}\n\nUSER QUESTION: {payload.message}"

    async def event_stream():
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