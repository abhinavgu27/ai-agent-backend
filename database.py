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

async def save_message(role, content):
    """Saves chat to MongoDB."""
    try:
        await chats_collection.insert_one({"role": role, "content": content})
    except Exception as e:
        print(f"❌ DB Save Error: {e}")

async def get_history(limit=10):
    """Retrieves the last few messages for context."""
    try:
        cursor = chats_collection.find().sort("_id", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [{"role": d["role"], "content": d["content"]} for d in reversed(docs)]
    except Exception as e:
        print(f"❌ DB Fetch Error: {e}")
        return []