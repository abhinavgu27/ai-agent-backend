from fastapi import FastAPI, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware # <--- Added
from pydantic import BaseModel # <--- Added
from brain import ask
from database import save_message, get_history
import json, asyncio, os

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

@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    # 1. Load long-term memory from MongoDB
    history = await get_history()

    async def event_stream():
        full_text = ""
        # 2. We pass the user's message and the database history to the brain
        for token in ask(payload.message, history):
            if token:
                full_text += token
                yield f"data: {json.dumps({'token': token})}\n\n"
            await asyncio.sleep(0.01)
        
        # 3. Save this conversation pair to MongoDB so it's remembered next time
        await save_message("user", payload.message)
        await save_message("assistant", full_text)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)