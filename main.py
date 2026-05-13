from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from brain import engine
import json
import os
import asyncio

app = FastAPI()

# 🛡️ Finalized CORS for Vercel <-> Render communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Required False for universal origins
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatPayload(BaseModel):
    message: str
    history: list = []

@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    async def event_stream():
        # Using an executor to prevent the generator from blocking the event loop
        loop = asyncio.get_event_loop()
        
        # Wrapped generator call for stability
        def get_tokens():
            return engine.ask(payload.message, payload.history)

        tokens = await loop.run_in_executor(None, get_tokens)
        
        for token in tokens:
            if token:
                # Proper SSE format for React frontend
                yield f"data: {json.dumps({'token': token})}\n\n"
            # Prevent connection timeouts on cloud providers
            await asyncio.sleep(0.01)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    # Render explicitly looks for port 10000 in your logs (image_2b49ba.png)
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)