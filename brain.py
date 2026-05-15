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
from PIL import Image

load_dotenv()

# Initialize API Clients
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY")
VOICE_ID = os.environ.get("VOICE_ID", "N2lVS1w4EtoT3dr4eOWO")

# ==========================================
# 🔧 PHASE 3: THE TOOLBOX (Safe Execution)
# ==========================================
def execute_python_code(code: str):
    output_buffer = io.StringIO()
    old_stdout = sys.stdout
    try:
        sys.stdout = output_buffer
        # Limited scope for safety with common modules pre-loaded
        exec_scope = {
            "math": __import__("math"), 
            "datetime": __import__("datetime"),
            "os": __import__("os"),
            "sys": __import__("sys"),
            "json": __import__("json")
        } 
        exec(code, exec_scope)
        sys.stdout = old_stdout
        result = output_buffer.getvalue()
        return result if result else "Success: Code executed (no output)."
    except Exception as e:
        sys.stdout = old_stdout
        return f"Execution Error: {str(e)}"

def execute_terminal_command(command: str):
    """Executes a system shell command and returns the output."""
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=15)
        output = result.stdout if result.stdout else result.stderr
        return output if output else "Command executed successfully (no output)."
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 15 seconds."
    except Exception as e:
        return f"Terminal Error: {str(e)}"

# Define Tool Schemas for Llama 3.3
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "execute_python_code",
            "description": "Run Python code for precise math, logic, or data analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "The Python code to execute."}
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_terminal_command",
            "description": "Run shell/terminal commands to check system status, time, or environment info.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The shell command to run (e.g., 'df -h', 'uptime')."}
                },
                "required": ["command"],
            },
        },
    }
]

# ==========================================
# 👁️ PHASE 1: VISION ANALYSIS
# ==========================================
def analyze_image(base64_image, user_prompt="Analyze this image in detail."):
    try:
        response = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[{
                "role": "user", 
                "content": [
                    {"type": "text", "text": user_prompt}, 
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                ]
            }],
            max_tokens=1024
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"Vision Error: {str(e)}"

# ==========================================
# 🧠 CORE AGENTIC REASONING (WITH PHASE 4 REFLECTION)
# ==========================================
def ask(user_message, history=[]):
    current_date = datetime.now().strftime("%B %d, %Y")
    system_prompt = (
        f"You are AGENT OS, a high-performance system. Date: {current_date}. "
        "You have 'execute_python_code' and 'execute_terminal_command'. "
        "CRITICAL: If a tool returns an ERROR, do not give up. Analyze the error message, "
        "fix your logic, and call the tool again until you get the correct result."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": user_message})

    # Reflection Loop Settings (Max 3 attempts to fix bugs internally)
    max_iterations = 3 
    iterations = 0

    try:
        while iterations < max_iterations:
            # Step 1: Decision/Action Call
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                tools=AGENT_TOOLS,
                tool_choice="auto"
            )

            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls

            # If the AI decides it has finished using tools
            if not tool_calls:
                completion = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=messages,
                    stream=True
                )
                for chunk in completion:
                    if chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
                break

            # If tools ARE requested
            messages.append(response_message)
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                
                if function_name == "execute_python_code":
                    yield f"*(⚙️ Running Logic - Attempt {iterations + 1}...)*\n\n"
                    result = execute_python_code(args.get("code"))
                elif function_name == "execute_terminal_command":
                    yield f"*(💻 Accessing System - Attempt {iterations + 1}...)*\n\n"
                    result = execute_terminal_command(args.get("command"))
                
                # Feedback loop: Store result (even errors) to let the AI fix itself
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": result,
                })

            iterations += 1
            
        if iterations >= max_iterations:
            yield "\n\n⚠️ *Max self-correction reached. Neural link strained.*"

    except Exception as e:
        yield f"⚠️ Neural Link Error: {str(e)}"

# ==========================================
# 🎙️ VOICE SYNTHESIS
# ==========================================
def generate_audio(text):
    if not ELEVENLABS_API_KEY: raise ValueError("API Key Missing")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream"
    headers = {"Accept": "audio/mpeg", "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY}
    data = {"text": text, "model_id": "eleven_turbo_v2_5", "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}
    response = requests.post(url, json=data, headers=headers, stream=True)
    if response.status_code != 200: raise Exception("Voice Generation Failed")
    return response.iter_content(chunk_size=1024)