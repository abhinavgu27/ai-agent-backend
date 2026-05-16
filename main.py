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
from groq import Groq 

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

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
SECRET_KEY = os.environ.get("JWT_SECRET", "agent_os_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password): return password_hash.verify(plain_password, hashed_password)
def get_password_hash(password): return password_hash.hash(password)
def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise HTTPException(status_code=401)
    except: raise HTTPException(status_code=401)
    return username

class UserRegister(BaseModel):
    username: str
    password: str

@app.post("/register")
async def register(user: UserRegister):
    if await get_user_from_db(user.username): raise HTTPException(status_code=400, detail="Username taken")
    await create_user_in_db(user.username, get_password_hash(user.password))
    return {"message": "User created successfully"}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await get_user_from_db(form_data.username)
    if not user or not verify_password(form_data.password, user["password"]): raise HTTPException(status_code=400)
    return {"access_token": create_access_token(data={"sub": user["username"]}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)), "token_type": "bearer"}

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
        elif filename.endswith(".pdf"):
            for page in PyPDF2.PdfReader(io.BytesIO(file_bytes)).pages: content += (page.extract_text() or "") + "\n"
        elif filename.endswith((".txt", ".md")): content = file_bytes.decode("utf-8")
        
        if content.strip():
            await save_file_context(current_user, session_id, file.filename, content)
            return {"status": "Success"}
    except Exception as e: return {"status": "Error", "message": str(e)}

@app.get("/files/{session_id}")
async def list_files(session_id: str, current_user: str = Depends(get_current_user)): return {"files": await get_uploaded_filenames(current_user, session_id)}

@app.delete("/files/{session_id}")
async def clear_files(session_id: str, current_user: str = Depends(get_current_user)):
    await clear_session_knowledge(current_user, session_id)
    return {"status": "Success"}

@app.get("/sessions")
async def list_sessions(current_user: str = Depends(get_current_user)): return {"sessions": await get_all_sessions(current_user)}

@app.get("/history/{session_id}")
async def get_session_history(session_id: str, current_user: str = Depends(get_current_user)): return {"history": await get_history(current_user, session_id, limit=50)}

@app.post("/chat")
async def chat_endpoint(payload: ChatPayload, current_user: str = Depends(get_current_user)):
    history = await get_history(current_user, payload.session_id)
    uploaded_knowledge = await get_all_file_context(current_user, payload.session_id)

    combined_message = payload.message
    if uploaded_knowledge: combined_message = f"[CONTEXT FROM ATTACHED FILES]:\n{uploaded_knowledge}\n\nUSER QUESTION: {payload.message}"

    async def event_stream():
        prompt_lower = payload.message.lower()
        
        if ("image" in prompt_lower or "picture" in prompt_lower) and any(w in prompt_lower for w in ["generate", "create", "make", "draw"]):
            image_url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(payload.message)}?width=1024&height=1024&nologo=true"
            await asyncio.sleep(1.5) 
            yield f"data: {json.dumps({'type': 'genui_event', 'widget_type': 'image_generated', 'image_url': image_url})}\n\n"
            await save_message(current_user, payload.session_id, "user", payload.message)
            await save_message(current_user, payload.session_id, "assistant", f"[GEN-UI: Image Generated]")
            return

        if any(t in prompt_lower for t in ["run command", "system status", "ping", "execute server"]):
            output = f"agent-os@root:~$ {payload.message}\n> Initializing secure shell...\n> [OK] Access Granted.\n> System status: NOMINAL.\n> Operation completed in 1.04s"
            await asyncio.sleep(1) 
            yield f"data: {json.dumps({'type': 'genui_event', 'widget_type': 'terminal_output', 'output': output})}\n\n"
            await save_message(current_user, payload.session_id, "user", payload.message)
            await save_message(current_user, payload.session_id, "assistant", f"[GEN-UI: Terminal Executed]")
            return

        is_build_verb = any(v in prompt_lower for v in ["build", "create", "make", "generate", "code me", "write a"])
        is_app_noun = any(n in prompt_lower for n in ["calculator", "clock", "timer", "website", "app", "ui", "component", "game"])
        
        if is_build_verb and is_app_noun:
            yield f"data: {json.dumps({'token': '*(⚙️ Compiling dynamic code artifact...)*\\n\\n'})}\n\n"
            try:
                sys_prompt = "You are an expert frontend developer. Return ONLY valid HTML code. No markdown tags."
                completion = groq_client.chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "system", "content": sys_prompt}, {"role": "user", "content": payload.message}], temperature=0.2)
                dynamic_html = completion.choices[0].message.content.strip()
                for prefix in ["```html", "```"]: 
                    if dynamic_html.startswith(prefix): dynamic_html = dynamic_html[len(prefix):]
                if dynamic_html.endswith("
http://googleusercontent.com/immersive_entry_chip/0

Push this to GitHub, start a new workspace, and test out asking for the live weather or pasting a GitHub Repo URL. Then, click the new **Camera Icon** in the top right corner to instantly download your spatial flow map!