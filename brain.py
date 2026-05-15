import os
from dotenv import load_dotenv
from groq import Groq
from duckduckgo_search import DDGS
from datetime import datetime

load_dotenv()

# Initialize the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def needs_web_search(user_message):
    """ROUTING AGENT: Decides if we need the internet."""
    try:
        print(f"🧭 Routing check for: '{user_message}'")
        response = client.chat.completions.create(
            model="llama3-8b-8192", 
            messages=[
                {
                    "role": "system", 
                    "content": "You are a routing assistant. Reply exactly YES if the user asks for news, current events, real-time prices, or today's information. Otherwise reply NO."
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=10,
            temperature=0.0
        )
        decision = response.choices[0].message.content.strip().upper()
        print(f"🧭 Router decided: {decision}")
        return "YES" in decision
    except Exception as e:
        print(f"❌ Router Error: {e}")
        return True # If the router crashes, fallback to searching just in case!

def perform_web_search(query):
    """TOOL: Fetches live data."""
    print(f"🌐 Searching web for: {query}")
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            if not results:
                return "No results found."
            return "\n".join([f"- {r['title']}: {r['body']}" for r in results])
    except Exception as e:
        print(f"❌ Web Search Error: {e}")
        return ""

def ask(user_message, history=[]):
    """MAIN AGENT"""
    # Give the AI a live clock so it knows what "today" means
    current_date = datetime.now().strftime("%B %d, %Y")
    
    system_prompt = (
        f"You are AGENT OS, a high-performance, professional AI assistant. "
        f"Today's date is {current_date}. "
        "Provide clear, accurate, and helpful responses."
    )

    # Check if we need to browse the web
    if needs_web_search(user_message):
        yield "*(🌐 Scanning the live web...)*\n\n"
        web_data = perform_web_search(user_message)
        if web_data:
            system_prompt += f"\n\n[LIVE WEB SEARCH RESULTS]:\n{web_data}\n\nUse this live data to answer the user's question accurately."

    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    
    messages.append({"role": "user", "content": user_message})

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