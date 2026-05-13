from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from brain import engine
import json

app = FastAPI()

# Allow your local frontend to connect
# Allow any local port to connect without triggering a 400 Bad Request
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=False, # Must be False when using "*"
    allow_methods=["*"], 
    allow_headers=["*"]
)

class ChatPayload(BaseModel):
    message: str
    history: list = []

@app.post("/chat")
async def chat_endpoint(payload: ChatPayload):
    def event_stream():
        for token in engine.ask(payload.message, payload.history):
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    import os
    # Get the port from Render's environment, or default to 8000
    port = int(os.environ.get("PORT", 8000)) 
    uvicorn.run(app, host="0.0.0.0", port=port)