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
# 💬 CHAT MEMORY 
# ==========================================
async def save_message(session_id: str, role: str, content: str):
    try:
        await chats_collection.insert_one({
            "session_id": session_id,
            "role": role, 
            "content": content
        })
    except Exception as e:
        print(f"❌ DB Save Error: {e}")

async def get_history(session_id: str, limit: int = 10):
    try:
        cursor = chats_collection.find({"session_id": session_id}).sort("_id", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [{"role": d["role"], "content": d["content"]} for d in reversed(docs)]
    except Exception as e:
        print(f"❌ DB Fetch Error: {e}")
        return []

async def get_all_sessions():
    try:
        pipeline = [
            {"$match": {"role": "user"}}, 
            {"$group": {
                "_id": "$session_id", 
                "title": {"$first": "$content"}, 
                "created_at": {"$first": "$_id"}
            }},
            {"$sort": {"created_at": -1}} 
        ]
        cursor = chats_collection.aggregate(pipeline)
        docs = await cursor.to_list(length=100)
        return [{"session_id": doc["_id"], "title": doc["title"][:30] + "..." if len(doc["title"]) > 30 else doc["title"]} for doc in docs]
    except Exception as e:
        print(f"❌ DB Session Fetch Error: {e}")
        return []

# ==========================================
# 🗂️ KNOWLEDGE BASE (ISOLATED BY SESSION)
# ==========================================
async def save_file_context(session_id: str, filename: str, content: str):
    await knowledge_collection.insert_one({
        "session_id": session_id,
        "filename": filename,
        "content": content
    })

async def get_all_file_context(session_id: str):
    cursor = knowledge_collection.find({"session_id": session_id})
    docs = await cursor.to_list(length=100)
    return "\n".join([d["content"] for d in docs])

async def get_uploaded_filenames(session_id: str):
    try:
        cursor = knowledge_collection.find({"session_id": session_id}, {"filename": 1, "_id": 0})
        docs = await cursor.to_list(length=100)
        return list(set([d.get("filename") for d in docs if "filename" in d]))
    except Exception as e:
        print(f"❌ Fetch Filenames Error: {e}")
        return []

async def clear_session_knowledge(session_id: str):
    try:
        await knowledge_collection.delete_many({"session_id": session_id})
    except Exception as e:
        print(f"❌ Delete Knowledge Error: {e}")