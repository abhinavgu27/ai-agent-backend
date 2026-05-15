from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import json
import asyncio
import os
import io
import PyPDF2

from brain import ask
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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

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
# 📂 FILE & SESSION ENDPOINTS (PROTECTED)
# ==========================================
class ChatPayload(BaseModel):
    message: str
    session_id: str = "default"

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...), current_user: str = Depends(get_current_user)):
    content = ""
    try:
        if file.filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(await file.read()))
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted: content += extracted + "\n"
        elif file.filename.endswith((".txt", ".md")):
            content = (await file.read()).decode("utf-8")
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)