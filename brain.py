import os
from dotenv import load_dotenv
from groq import Groq
# REMOVED: search_knowledge_base import since we are using Database RAG now

load_dotenv()

# Initialize the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def ask(user_message, history=[]):
    """
    Queries the Llama-3 model. The context is now passed 
    directly through the user_message from main.py.
    """
    
    # 1. Clean System Prompt (No more hardcoded GRIIN)
    system_prompt = (
        "You are AGENT OS, a high-performance, professional AI assistant. "
        "Provide clear, accurate, and helpful responses. If context from uploaded "
        "files is provided, use it to answer precisely."
    )

    # 2. Build the messages array
    messages = [{"role": "system", "content": system_prompt}]
    
    # 3. Add chat history
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    
    # 4. Add the current user message (which already contains the DB context from main.py)
    messages.append({"role": "user", "content": user_message})

    # 5. Stream response using the Llama-3 70B model
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True,
            temperature=0.6
        )
        for chunk in completion:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        yield f"⚠️ Neural Link Error: {str(e)}"