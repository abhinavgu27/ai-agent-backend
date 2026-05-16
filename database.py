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
users_collection = db.users  
canvas_collection = db.canvas_states  # 🗺️ NEW: Spatial Memory Collection

# ==========================================
# 🔒 USER AUTHENTICATION
# ==========================================
async def create_user_in_db(username, hashed_password):
    """Saves a new user to the database."""
    await users_collection.insert_one({"username": username, "password": hashed_password})

async def get_user_from_db(username):
    """Retrieves a user by username."""
    return await users_collection.find_one({"username": username})

# ==========================================
# 💬 CHAT MEMORY (ISOLATED BY USER AND SESSION)
# ==========================================
async def save_message(username: str, session_id: str, role: str, content: str):
    try:
        await chats_collection.insert_one({
            "username": username,
            "session_id": session_id,
            "role": role, 
            "content": content
        })
    except Exception as e:
        print(f"❌ DB Save Error: {e}")

async def get_history(username: str, session_id: str, limit: int = 10):
    try:
        cursor = chats_collection.find({"username": username, "session_id": session_id}).sort("_id", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [{"role": d["role"], "content": d["content"]} for d in reversed(docs)]
    except Exception as e:
        print(f"❌ DB Fetch Error: {e}")
        return []

async def get_all_sessions(username: str):
    try:
        pipeline = [
            {"$match": {"username": username, "role": "user"}}, 
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
# 🗂️ KNOWLEDGE BASE (ISOLATED BY USER AND SESSION)
# ==========================================
async def save_file_context(username: str, session_id: str, filename: str, content: str):
    await knowledge_collection.insert_one({
        "username": username,
        "session_id": session_id,
        "filename": filename,
        "content": content
    })

async def get_all_file_context(username: str, session_id: str):
    cursor = knowledge_collection.find({"username": username, "session_id": session_id})
    docs = await cursor.to_list(length=100)
    return "\n".join([d["content"] for d in docs])

async def get_uploaded_filenames(username: str, session_id: str):
    try:
        cursor = knowledge_collection.find({"username": username, "session_id": session_id}, {"filename": 1, "_id": 0})
        docs = await cursor.to_list(length=100)
        return list(set([d.get("filename") for d in docs if "filename" in d]))
    except Exception as e:
        print(f"❌ Fetch Filenames Error: {e}")
        return []

async def clear_session_knowledge(username: str, session_id: str):
    try:
        await knowledge_collection.delete_many({"username": username, "session_id": session_id})
    except Exception as e:
        print(f"❌ Delete Knowledge Error: {e}")

# ==========================================
# 🗺️ TRUE SPATIAL MEMORY (NEW)
# ==========================================
async def save_canvas_state(username: str, session_id: str, nodes: list, edges: list):
    try:
        await canvas_collection.update_one(
            {"username": username, "session_id": session_id},
            {"$set": {"nodes": nodes, "edges": edges}},
            upsert=True
        )
    except Exception as e:
        print(f"❌ DB Canvas Save Error: {e}")

async def get_canvas_state(username: str, session_id: str):
    try:
        doc = await canvas_collection.find_one({"username": username, "session_id": session_id})
        if doc:
            return {"nodes": doc.get("nodes", []), "edges": doc.get("edges", [])}
        return None
    except Exception as e:
        print(f"❌ DB Canvas Fetch Error: {e}")
        return None