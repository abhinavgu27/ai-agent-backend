import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")

if not MONGO_URL:
    print("❌ ERROR: MONGO_URL not found in environment variables!")

# Initialize client
client = AsyncIOMotorClient(MONGO_URL)
db = client.agent_os_pro
chats_collection = db.conversations
knowledge_collection = db.knowledge

# ==========================================
# 💬 CHAT MEMORY (UPDATED FOR SESSIONS)
# ==========================================
async def save_message(session_id: str, role: str, content: str):
    """Saves chat to MongoDB under a specific session."""
    try:
        await chats_collection.insert_one({
            "session_id": session_id,
            "role": role, 
            "content": content
        })
    except Exception as e:
        print(f"❌ DB Save Error: {e}")

async def get_history(session_id: str, limit: int = 10):
    """Retrieves context ONLY for the current session."""
    try:
        cursor = chats_collection.find({"session_id": session_id}).sort("_id", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [{"role": d["role"], "content": d["content"]} for d in reversed(docs)]
    except Exception as e:
        print(f"❌ DB Fetch Error: {e}")
        return []

async def get_all_sessions():
    """Retrieves a list of all unique sessions for the sidebar."""
    try:
        # Group chats by session_id and grab the first user message as the title
        pipeline = [
            {"$match": {"role": "user"}}, 
            {"$group": {
                "_id": "$session_id", 
                "title": {"$first": "$content"}, 
                "created_at": {"$first": "$_id"}
            }},
            {"$sort": {"created_at": -1}} # Newest sessions at the top
        ]
        cursor = chats_collection.aggregate(pipeline)
        docs = await cursor.to_list(length=100)
        
        # Format for the frontend
        return [{"session_id": doc["_id"], "title": doc["title"][:30] + "..." if len(doc["title"]) > 30 else doc["title"]} for doc in docs]
    except Exception as e:
        print(f"❌ DB Session Fetch Error: {e}")
        return []

# ==========================================
# 🗂️ KNOWLEDGE BASE (FILES)
# ==========================================
async def save_file_context(filename, content):
    """Saves uploaded file text to the database."""
    await knowledge_collection.insert_one({
        "filename": filename,
        "content": content
    })

async def get_all_file_context():
    """Retrieves all uploaded knowledge for the AI."""
    cursor = knowledge_collection.find()
    docs = await cursor.to_list(length=100)
    return "\n".join([d["content"] for d in docs])

async def get_uploaded_filenames():
    """Returns a list of unique filenames currently in the AI's memory."""
    try:
        cursor = knowledge_collection.find({}, {"filename": 1, "_id": 0})
        docs = await cursor.to_list(length=100)
        return list(set([d.get("filename") for d in docs if "filename" in d]))
    except Exception as e:
        print(f"❌ Fetch Filenames Error: {e}")
        return []

async def clear_all_knowledge():
    """Wipes the active file memory."""
    try:
        await knowledge_collection.delete_many({})
    except Exception as e:
        print(f"❌ Delete Knowledge Error: {e}")