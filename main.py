from fastapi import FastAPI, UploadFile, File
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
    clear_all_knowledge,
    get_all_sessions
)
import json
import asyncio
import os
import io
import PyPDF2

app = FastAPI()

# IMPORTANT: You must add this or your frontend won't be able to connect
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
async def upload_file(file: UploadFile = File(...)):
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
            return {"status": "Error", "message": "Unsupported file format. Please upload PDF, TXT, or MD."}

        if content.strip():
            await save_file_context(file.filename, content)
            return {"status": "Success", "message": f"{file.filename} absorbed into memory."}
        else:
            return {"status": "Error", "message": "File is empty or text could not be extracted."}
    except Exception as e:
        return {"status": "Error", "message": str(e)}

# ==========================================
# 🗂️ FILE MANAGEMENT ENDPOINTS
# ==========================================
@app.get("/files")
async def list_files():
    """Returns the list of files the AI currently has in memory."""
    files = await get_uploaded_filenames()
    return {"files": files}

@app.delete("/files")
async def clear_files():
    """Clears all uploaded files from the AI's memory."""
    await clear_all_knowledge()
    return {"status": "Success", "message": "Knowledge base purged."}

# ==========================================
# 💬 SESSION MANAGEMENT ENDPOINTS
# ==========================================
@app.get("/sessions")
async def list_sessions():
    """Returns all past chat sessions for the sidebar."""
    sessions = await get_all_sessions()
    return {"sessions": sessions}

@app.get("/history/{session_id}")
async def get_session_history(session_id: str):
    """Fetches the full visual chat log for the frontend."""
    # We fetch up to 50 past messages for the screen
    history = await get_history(session_id, limit=50)
    return {"history": history}

# ==========================================
# 💬 CHAT ENDPOINT WITH RAG & SESSIONS
# ==========================================
@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    # 1. Load long-term memory FOR THIS SPECIFIC SESSION
    history = await get_history(payload.session_id)
    
    # 2. Load uploaded file knowledge from MongoDB
    uploaded_knowledge = await get_all_file_context()

    # 3. Combine knowledge with the user's question
    combined_message = payload.message
    if uploaded_knowledge:
        # Invisible injection: The AI sees the file text, but the user just sees their own question
        combined_message = f"[CONTEXT FROM UPLOADED FILES]:\n{uploaded_knowledge}\n\nUSER QUESTION: {payload.message}"

    async def event_stream():
        full_text = ""
        # 4. Pass the SUPER PROMPT (history + files + question) to the brain
        for token in ask(combined_message, history):
            if token:
                full_text += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            await asyncio.sleep(0.01)
        
        # 5. Save ONLY the user's original message to history (with the specific session ID)
        await save_message(payload.session_id, "user", payload.message)
        await save_message(payload.session_id, "assistant", full_text)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)