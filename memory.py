import os

DOCS_DIR = "./docs"

def build_knowledge_base():
    """
    Lightweight version for Cloud compatibility.
    Checks if the docs folder exists and lists the knowledge files.
    """
    print("🧠 Scanning knowledge base...")
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        print(f"📁 Created '{DOCS_DIR}' folder.")
    
    files = [f for f in os.listdir(DOCS_DIR) if f.endswith(('.txt', '.md'))]
    if files:
        print(f"✅ Ready to recall {len(files)} document(s): {', '.join(files)}")
    else:
        print("⚠️ No documents found in /docs. Add .txt files for memory.")

def search_knowledge_base(query):
    """
    Direct-Inject Retrieval.
    Reads your files directly into the AI's context window.
    This is bulletproof on Render and extremely accurate for Llama-3.
    """
    if not os.path.exists(DOCS_DIR):
        return ""

    context = ""
    # We read all text files in the docs folder
    for filename in os.listdir(DOCS_DIR):
        if filename.endswith(".txt") or filename.endswith(".md"):
            filepath = os.path.join(DOCS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    context += f"\n--- DATA SOURCE: {filename} ---\n"
                    context += f.read() + "\n"
            except Exception as e:
                print(f"❌ Error reading {filename}: {e}")

    return context

if __name__ == "__main__":
    build_knowledge_base()