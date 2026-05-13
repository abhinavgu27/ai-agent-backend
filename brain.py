import os
from dotenv import load_dotenv
from groq import Groq
from memory import search_knowledge_base

load_dotenv()

# Initialize the Groq client with your API key
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def ask(user_message, history=[]):
    """
    Coordinates lightweight RAG by reading local docs and 
    querying the Llama-3 model.
    """
    # 1. Retrieve the content of your files from the /docs folder
    context = search_knowledge_base(user_message)
    
    # 2. Build the System Prompt with the context injected
    system_prompt = "You are AGENT OS, a high-performance, professional AI assistant."
    
    if context:
        system_prompt += f"\n\n[CONTEXT FROM YOUR SECURE FILES]:\n{context}\n\nUse this information to answer precisely."

    # 3. Format the chat history
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    
    messages.append({"role": "user", "content": user_message})

    # 4. Stream response using the Llama-3 70B model
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