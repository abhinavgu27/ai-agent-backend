import os

DOCS_DIR = "./docs"

def search_knowledge_base(query):
    """
    Lightweight Memory Engine.
    Scans the /docs folder and returns the content of all .txt and .md files.
    """
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        return ""

    context = ""
    # Only reads lightweight text formats to stay within RAM limits
    for filename in os.listdir(DOCS_DIR):
        if filename.endswith((".txt", ".md")):
            filepath = os.path.join(DOCS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    context += f"\n--- SOURCE: {filename} ---\n"
                    context += f.read() + "\n"
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                
    return context