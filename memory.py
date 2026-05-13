from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import os

# 1. Setup the Embedding Model (This turns text into numbers)
# Using a fast, open-source model that runs locally
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# 2. Setup Database and Document Directories
DB_DIR = "./chroma_db"
DOCS_DIR = "./docs"

def build_knowledge_base():
    """Reads files from the docs/ folder and saves them to the Vector DB."""
    print("🧠 Scanning documents...")
    
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        print(f"Created '{DOCS_DIR}' folder. Drop your files in there and run again!")
        return

    # Load all text and PDF files
    loaders = {
        ".txt": DirectoryLoader(DOCS_DIR, glob="**/*.txt", loader_cls=TextLoader),
        ".pdf": DirectoryLoader(DOCS_DIR, glob="**/*.pdf", loader_cls=PyPDFLoader)
    }
    
    documents = []
    for ext, loader in loaders.items():
        try:
            documents.extend(loader.load())
        except Exception as e:
            pass

    if not documents:
        print("⚠️ No documents found. Please put some .txt or .pdf files in the 'docs' folder.")
        return

    # Split documents into smaller chunks so the AI can digest them
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    texts = text_splitter.split_documents(documents)

    print(f"📚 Found {len(documents)} document(s). Split into {len(texts)} chunks.")
    print("⚙️ Memorizing into Vector Database (this might take a moment the first time)...")

    # Save to ChromaDB locally
    vectorstore = Chroma.from_documents(documents=texts, embedding=embeddings, persist_directory=DB_DIR)
    print("✅ Knowledge Base successfully updated!")

def search_knowledge_base(query, k=3):
    """Searches the database for the most relevant context."""
    if not os.path.exists(DB_DIR):
        return ""
        
    vectorstore = Chroma(persist_directory=DB_DIR, embedding_function=embeddings)
    results = vectorstore.similarity_search(query, k=k)
    
    # Combine the top matching chunks into one text string
    context = "\n\n".join([doc.page_content for doc in results])
    return context

# When you run this file directly, it will build the database
if __name__ == "__main__":
    build_knowledge_base()