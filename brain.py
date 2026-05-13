import os
from dotenv import load_dotenv
from groq import Groq
from memory import search_knowledge_base  # <-- Import the new memory engine!

# Load environment variables (API Key)
load_dotenv()

# Initialize the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def ask(user_message, history=[]):
    """
    Sends the conversation to Groq and yields the streaming response.
    Now equipped with Long-Term Memory (RAG).
    """
    
    # 1. Search the Vector Database for relevant files
    print(f"🔍 Searching memory for: {user_message}")
    context = search_knowledge_base(user_message)
    
    # 2. Build the System Prompt with the retrieved knowledge
    system_prompt = "You are a highly advanced, professional cloud AI agent."
    
    if context:
        system_prompt += f"\n\nHere is some highly relevant context from the user's secure files. Use this to answer their question accurately:\n\n{context}"
        print("🧠 Memory retrieved and injected into prompt!")

    # 3. Format the conversation history for Groq
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in history:
        # Convert frontend roles ('user', 'assistant') to Groq roles if necessary
        role = msg.get("role", "user")
        messages.append({"role": role, "content": msg.get("content", "")})
    
    # Add the newest user message
    messages.append({"role": "user", "content": user_message})

    # 4. Stream the response from the Llama 3 70B model
    try:
        completion = client.chat.completions.create(
            model="llama3-70b-8192", # Or "llama3-8b-8192" for speed
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=1024
        )

        for chunk in completion:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content
                
    except Exception as e:
        print(f"Groq API Error: {e}")
        yield "⚠️ Neural Engine Error: Failed to connect to Groq."