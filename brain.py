import os
from dotenv import load_dotenv
from groq import Groq
from duckduckgo_search import DDGS

load_dotenv()

# Initialize the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def needs_web_search(user_message):
    """
    ROUTING AGENT: Quickly asks a fast, cheap model if the query 
    requires live internet data (news, sports, current prices, etc.).
    """
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192", 
            messages=[
                {
                    "role": "system", 
                    "content": "You are a routing AI. If the user's prompt requires recent news, real-time facts, current events, or live internet data, reply with exactly 'YES'. Otherwise, reply 'NO'."
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=10,
            temperature=0.0
        )
        return "YES" in response.choices[0].message.content.upper()
    except:
        return False

def perform_web_search(query):
    """TOOL: Fetches live data from DuckDuckGo."""
    try:
        with DDGS() as ddgs:
            # Grab the top 3 live search results
            results = list(ddgs.text(query, max_results=3))
            if not results:
                return ""
            return "\n".join([f"Source: {r['title']}\nInfo: {r['body']}" for r in results])
    except Exception as e:
        print(f"Search Error: {e}")
        return ""

def ask(user_message, history=[]):
    """
    MAIN AGENT: Queries the massive Llama-3 model, injecting live web 
    data and attached PDFs if necessary.
    """
    system_prompt = (
        "You are AGENT OS, a high-performance, professional AI assistant. "
        "Provide clear, accurate, and helpful responses. "
    )

    # 🌐 AUTONOMOUS ACTION: Check if we need to browse the web
    if needs_web_search(user_message):
        yield "*(🌐 Scanning the live web for real-time data...)*\n\n"
        web_data = perform_web_search(user_message)
        if web_data:
            system_prompt += f"\n\n[LIVE WEB SEARCH RESULTS]:\n{web_data}\n\nUse this live data to answer the user's question accurately."

    # Build the messages array
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    
    messages.append({"role": "user", "content": user_message})

    # Stream response using the heavy Llama-3 70B model
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