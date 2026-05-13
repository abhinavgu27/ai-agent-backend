from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import asyncio

# Import the logic from your brain.py
from brain import ask

app = FastAPI()

# Cloud-safe CORS settings for your Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatPayload(BaseModel):
    message: str
    history: list = []

@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    async def event_stream():
        loop = asyncio.get_event_loop()
        
        # Wrapping the generator in an executor to keep the API responsive
        def get_tokens():
            return ask(payload.message, payload.history)

        tokens = await loop.run_in_executor(None, get_tokens)
        
        for token in tokens:
            if token:
                # Standard Server-Sent Events (SSE) format
                yield f"data: {json.dumps({'token': token})}\n\n"
            # Tiny sleep to prevent cloud connection timeouts
            await asyncio.sleep(0.01)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    # Render looks for the PORT environment variable (default 10000)
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)