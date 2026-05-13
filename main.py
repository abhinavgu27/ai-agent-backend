__import__('pysqlite3')
import sys
sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from brain import engine
from memory import build_knowledge_base
import json
import os
import asyncio
import threading # <-- Added for background processing

app = FastAPI()

# Tell the app to build the memory IN THE BACKGROUND once the server starts
@app.on_event("startup")
async def startup_event():
    print("🚀 Server starting up... launching memory builder in background.")
    # This stops the heavy embedding model from blocking Render's port check
    thread = threading.Thread(target=build_knowledge_base)
    thread.start()

# Cloud-safe CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... (Keep the rest of your ChatPayload and /chat endpoint exactly the same below this)

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