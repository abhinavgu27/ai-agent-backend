from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from brain import ask
from database import (
    save_message, 
    get_history, 
    save_file_context, 
    get_all_file_context, 
    get_uploaded_filenames, 
    clear_session_knowledge,
    get_all_sessions
)
import json
import asyncio
import os
import io
import PyPDF2

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatPayload(BaseModel):
    message: str
    session_id: str = "default"

# ==========================================
# 📂 FILE UPLOAD ENDPOINT
# ==========================================
@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...)):
    content = ""
    try:
        if file.filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(await file.read()))
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    content += extracted + "\n"
        elif file.filename.endswith((".txt", ".md")):
            content = (await file.read()).decode("utf-8")
        else:
            return {"status": "Error", "message": "Unsupported file format."}

        if content.strip():
            await save_file_context(session_id, file.filename, content)
            return {"status": "Success", "message": f"{file.filename} attached to session."}
        else:
            return {"status": "Error", "message": "File is empty."}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

# ==========================================
# 🗂️ FILE MANAGEMENT ENDPOINTS
# ==========================================
@app.get("/files/{session_id}")
async def list_files(session_id: str):
    files = await get_uploaded_filenames(session_id)
    return {"files": files}

@app.delete("/files/{session_id}")
async def clear_files(session_id: str):
    await clear_session_knowledge(session_id)
    return {"status": "Success", "message": "Session files cleared."}

# ==========================================
# 💬 SESSION MANAGEMENT ENDPOINTS
# ==========================================
@app.get("/sessions")
async def list_sessions():
    sessions = await get_all_sessions()
    return {"sessions": sessions}

@app.get("/history/{session_id}")
async def get_session_history(session_id: str):
    history = await get_history(session_id, limit=50)
    return {"history": history}

# ==========================================
# 💬 CHAT ENDPOINT WITH RAG
# ==========================================
@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    history = await get_history(payload.session_id)
    
    # 🎯 ONLY fetch files uploaded inside THIS specific chat
    uploaded_knowledge = await get_all_file_context(payload.session_id)

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
        
        await save_message(payload.session_id, "user", payload.message)
        await save_message(payload.session_id, "assistant", full_text)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)