from fastapi import FastAPI, UploadFile, File  # Removed StreamingResponse from here
from fastapi.responses import StreamingResponse # Added this separate line
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from brain import ask
from database import save_message, get_history, save_file_context, get_all_file_context
import json
import asyncio
import os
import io
import PyPDF2

# ... the rest of your code ...

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

# ==========================================
# 📂 NEW: FILE UPLOAD ENDPOINT
# ==========================================
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = ""
    
    try:
        # 1. Read PDF Files
        if file.filename.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(await file.read()))
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    content += extracted + "\n"
                    
        # 2. Read Text or Markdown Files
        elif file.filename.endswith((".txt", ".md")):
            content = (await file.read()).decode("utf-8")
            
        else:
            return {"status": "Error", "message": "Unsupported file format. Please upload PDF, TXT, or MD."}

        # 3. Save to MongoDB if content was found
        if content.strip():
            await save_file_context(file.filename, content)
            return {"status": "Success", "message": f"{file.filename} absorbed into memory."}
        else:
            return {"status": "Error", "message": "File is empty or text could not be extracted."}
            
    except Exception as e:
        return {"status": "Error", "message": str(e)}


# ==========================================
# 💬 UPGRADED: CHAT ENDPOINT WITH RAG
# ==========================================
@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    # 1. Load long-term memory (chat history) from MongoDB
    history = await get_history()
    
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
        
        # 5. Save ONLY the user's original message to history (keeps the database clean)
        await save_message("user", payload.message)
        await save_message("assistant", full_text)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)