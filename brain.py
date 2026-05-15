import os
import base64
import requests
import io
from dotenv import load_dotenv
from groq import Groq
from tavily import TavilyClient
from datetime import datetime
from PIL import Image

load_dotenv()

# Initialize API Clients
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
VOICE_ID = os.environ.get("VOICE_ID", "N2lVS1w4EtoT3dr4eOWO") # Default to Callum

# ==========================================
# 👁️ PHASE 1: VISION ANALYSIS LAYER
# ==========================================
def analyze_image(base64_image, user_prompt="Analyze this image in detail for a professional assistant."):
    """Sends a base64 encoded image to the Llama-3.2-Vision model."""
    try:
        response = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            max_tokens=1024,
            temperature=0.5
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Vision Analysis Error: {str(e)}"

# ==========================================
# 🌐 WEB SEARCH LAYER
# ==========================================
def needs_web_search(user_message):
    try:
        response = client.chat.completions.create(
            model="llama3-8b-8192", 
            messages=[
                {"role": "system", "content": "You are a routing assistant. Reply exactly YES if the user asks for news, current events, real-time prices, or today's information. Otherwise reply NO."},
                {"role": "user", "content": user_message}
            ],
            max_tokens=10, temperature=0.0
        )
        return "YES" in response.choices[0].message.content.strip().upper()
    except:
        return True 

def perform_web_search(query):
    try:
        response = tavily_client.search(query=query, search_depth="basic", max_results=3)
        results = [f"- {res['title']}: {res['content']}" for res in response.get('results', [])]
        return "\n".join(results) if results else "No results found."
    except Exception:
        return ""

# ==========================================
# 🧠 CORE REASONING ENGINE
# ==========================================
def ask(user_message, history=[]):
    current_date = datetime.now().strftime("%B %d, %Y")
    
    system_prompt = (
        f"You are AGENT OS, a high-performance, professional AI assistant. "
        f"Today's date is {current_date}. "
        "You have multimodal capabilities and can analyze images and web data. "
        "Provide clear, accurate, and helpful responses. Keep your answers concise for voice compatibility."
    )

    # Trigger Web Search if needed
    if needs_web_search(user_message):
        yield "*(🌐 Scanning the live web...)*\n\n"
        web_data = perform_web_search(user_message)
        if web_data:
            system_prompt += f"\n\n[LIVE WEB SEARCH RESULTS]:\n{web_data}\n\nUse this live data to answer accurately."

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

# ==========================================
# 🎙️ VOICE SYNTHESIS LAYER
# ==========================================
def generate_audio(text):
    """Takes the final AI text and requests an audio stream from ElevenLabs."""
    if not ELEVENLABS_API_KEY:
        raise ValueError("ElevenLabs API key is missing.")
        
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream"
    
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY
    }
    
    data = {
        "text": text,
        "model_id": "eleven_turbo_v2_5",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
    }
    
    response = requests.post(url, json=data, headers=headers, stream=True)
    
    if response.status_code != 200:
        raise Exception(f"Voice generation failed: {response.text}")
        
    return response.iter_content(chunk_size=1024)