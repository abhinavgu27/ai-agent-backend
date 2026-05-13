import os
from groq import Groq
from ddgs import DDGS
import yfinance as yf

# NOTE: Set your API key in your terminal before running!
# Windows: $env:GROQ_API_KEY="gsk_your_key_here"

class AIEngine:
    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY")
        self.client = Groq(api_key=api_key)
        
        # Using Llama-3 8B - Blazing fast and incredibly smart
        self.model_id = "llama-3.3-70b-versatile" 
        print("⚡ Serverless Agent Engine is Ready! Connected to Groq.")

    # --- TOOL 1: THE WEB BROWSER ---
    def tool_web_search(self, query):
        print(f"\n[AGENT ACTION] Searching web for: {query}")
        try:
            results = DDGS().text(query, max_results=3)
            if not results: return "No results found."
            context = "Real-time Web Search Results:\n"
            for i, r in enumerate(results):
                context += f"{i+1}. {r['title']}: {r['body']}\n"
            return context
        except Exception as e:
            return f"Search failed: {e}"

    # --- TOOL 2: THE FINANCIAL TERMINAL ---
    def tool_get_price(self, asset):
        print(f"\n[AGENT ACTION] Fetching market data for: {asset}")
        asset_clean = asset.lower().strip()
        tickers = {
            "bitcoin": "BTC-USD", "btc": "BTC-USD",
            "ethereum": "ETH-USD", "eth": "ETH-USD",
            "apple": "AAPL", "google": "GOOGL", "microsoft": "MSFT",
            "tesla": "TSLA", "nvidia": "NVDA"
        }
        symbol = tickers.get(asset_clean, asset_clean.upper())
        try:
            ticker_data = yf.Ticker(symbol)
            price = ticker_data.history(period="1d")['Close'].iloc[-1]
            return f"LIVE MARKET DATA: The current exact price of {asset.upper()} ({symbol}) is ${price:,.2f} USD."
        except Exception as e:
            return "Finance data unavailable. Try web search instead."

    # --- THE SERVERLESS BRAIN ---
    def ask(self, prompt, history=[]):
        # 1. Routing Decision via Groq
        router_prompt = f"Analyze: '{prompt}'. If asking for a stock or crypto price, output 'PRICE: [asset name]'. If asking for general news or facts, output 'SEARCH: [query]'. Otherwise output 'NO'. Reply ONLY with the command."
        
        r_response = self.client.chat.completions.create(
            model=self.model_id,
            messages=[{"role": "user", "content": router_prompt}],
            temperature=0.1,
            max_tokens=20
        )
        decision = r_response.choices[0].message.content

        tool_context = ""
        
        # 2. Tool Execution
        if "PRICE:" in decision:
            asset = decision.replace("PRICE:", "").strip().strip("[]'\"")
            yield f"> 📈 *Agent securely connected to financial markets for: **{asset}***\n\n"
            tool_context = f"\n\n[REAL-TIME CONTEXT]:\n{self.tool_get_price(asset)}\n"
            
        elif "SEARCH:" in decision:
            query = decision.replace("SEARCH:", "").strip().strip("[]'\"")
            yield f"> 🌐 *Agent autonomously searched the web for: **{query}***\n\n"
            tool_context = f"\n\n[REAL-TIME CONTEXT]:\n{self.tool_web_search(query)}\n"

        # 3. Final Generation via Groq Streaming
        system_instruction = "You are a professional AI. Use the provided [REAL-TIME CONTEXT] to answer clearly and accurately. Never say you cannot access real-time data."
        
        messages = [{"role": "system", "content": system_instruction}]
        for msg in history: messages.append(msg)
        messages.append({"role": "user", "content": prompt + tool_context})
        
        stream = self.client.chat.completions.create(
            model=self.model_id,
            messages=messages,
            stream=True,
            temperature=0.7
        )

        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content

engine = AIEngine()