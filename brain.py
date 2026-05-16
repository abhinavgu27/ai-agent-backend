import os
import base64
import requests
import io
import sys
import json
import subprocess
from dotenv import load_dotenv
from groq import Groq
from tavily import TavilyClient
from datetime import datetime

load_dotenv()

# Initialize API Clients
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
VOICE_ID = os.environ.get("VOICE_ID", "N2lVS1w4EtoT3dr4eOWO")

# ==========================================
# 🔧 PHASE 6: THE GOD-TIER TOOLBOX
# ==========================================
def execute_python_code(code: str):
    output_buffer = io.StringIO()
    old_stdout = sys.stdout
    try:
        sys.stdout = output_buffer
        exec_scope = { "math": __import__("math"), "datetime": __import__("datetime"), "os": __import__("os"), "sys": __import__("sys"), "json": __import__("json") } 
        exec(code, exec_scope)
        sys.stdout = old_stdout
        result = output_buffer.getvalue()
        return result if result else "Success: Code executed (no output)."
    except Exception as e:
        sys.stdout = old_stdout
        return f"Execution Error: {str(e)}"

def execute_terminal_command(command: str):
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=15)
        output = result.stdout if result.stdout else result.stderr
        return output if output else "Command executed successfully (no output)."
    except Exception as e:
        return f"Terminal Error: {str(e)}"

def execute_web_search(query: str):
    try:
        response = tavily_client.search(query=query, search_depth="advanced")
        results = [f"Source: {res['url']}\nContent: {res['content']}" for res in response['results']]
        return "\n\n".join(results)
    except Exception as e:
        return f"Web Search Error: {str(e)}"

def fetch_github_readme(repo_url: str):
    try:
        parts = repo_url.replace("https://github.com/", "").replace("https://www.github.com/", "").split("/")
        user, repo = parts[0], parts[1]
        api_url = f"https://api.github.com/repos/{user}/{repo}/readme"
        res = requests.get(api_url).json()
        if "content" in res:
            readme = base64.b64decode(res["content"]).decode('utf-8')
            return f"Repository Readme for {user}/{repo}:\n{readme}"
        return "Error: Could not fetch repo. Ensure the URL is public and correct."
    except Exception as e:
         return f"GitHub API Error: {str(e)}"

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "execute_python_code",
            "description": "Run Python code for precise math, logic, or data analysis. DO NOT use this for generating graphical UI.",
            "parameters": { "type": "object", "properties": { "code": {"type": "string", "description": "The Python code to execute."} }, "required": ["code"] }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_terminal_command",
            "description": "Run shell/terminal commands.",
            "parameters": { "type": "object", "properties": { "command": {"type": "string"} }, "required": ["command"] }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_web_search",
            "description": "Search the live internet for current events, weather, news, or factual lookups.",
            "parameters": { "type": "object", "properties": { "query": {"type": "string", "description": "The search engine query."} }, "required": ["query"] }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_github_readme",
            "description": "Clone and read the documentation/readme of any public GitHub repository URL.",
            "parameters": { "type": "object", "properties": { "repo_url": {"type": "string", "description": "The full GitHub URL."} }, "required": ["repo_url"] }
        }
    }
]

# ==========================================
# 👁️ PHASE 1: VISION ANALYSIS
# ==========================================
def analyze_image(base64_image, user_prompt="Analyze this image in detail."):
    try:
        response = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[{"role": "user", "content": [{"type": "text", "text": user_prompt}, {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}]}],
            max_tokens=1024
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Vision Error: {str(e)}"

# ==========================================
# 🧠 CORE AGENTIC REASONING
# ==========================================
def ask(user_message, history=[]):
    current_date = datetime.now().strftime("%B %d, %Y")
    
    system_prompt = (
        f"You are AGENT OS, a high-performance system. Date: {current_date}. "
        "CRITICAL RULES:\n"
        "1. If you use 'execute_web_search', you MUST start your response with EXACTLY: '*(🌐 Scanning the live web...)*\\n\\n'\n"
        "2. If you use 'fetch_github_readme', you MUST start your response with EXACTLY: '*(🐙 Cloning GitHub Repository...)*\\n\\n'\n"
        "3. If the user asks to GENERATE code (Python, HTML), just output markdown. ONLY use 'execute_python_code' if they ask to RUN or CALCULATE something.\n"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": user_message})

    max_iterations = 3 
    iterations = 0

    try:
        while iterations < max_iterations:
            response = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, tools=AGENT_TOOLS, tool_choice="auto")
            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls

            if not tool_calls:
                completion = client.chat.completions.create(model="llama-3.3-70b-versatile", messages=messages, stream=True)
                for chunk in completion:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                break

            messages.append(response_message)
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                try: args = json.loads(tool_call.function.arguments)
                except: continue
                
                if function_name == "execute_python_code":
                    yield f"*(⚙️ Running Logic...)*\n\n"
                    result = execute_python_code(args.get("code"))
                elif function_name == "execute_terminal_command":
                    yield f"*(💻 Accessing System...)*\n\n"
                    result = execute_terminal_command(args.get("command"))
                elif function_name == "execute_web_search":
                    result = execute_web_search(args.get("query"))
                elif function_name == "fetch_github_readme":
                    result = fetch_github_readme(args.get("repo_url"))
                
                messages.append({"tool_call_id": tool_call.id, "role": "tool", "name": function_name, "content": result})
            iterations += 1
            
        if iterations >= max_iterations: yield "\n\n⚠️ *Max self-correction reached.*"
    except Exception as e: yield f"⚠️ Neural Link Error: {str(e)}"

def generate_audio(text):
    if not ELEVENLABS_API_KEY: raise ValueError("API Key Missing")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream"
    headers = {"Accept": "audio/mpeg", "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY}
    data = {"text": text, "model_id": "eleven_turbo_v2_5", "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    response = requests.post(url, json=data, headers=headers, stream=True)
    return response.iter_content(chunk_size=1024)