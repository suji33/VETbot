"""
MongoDB Atlas Persistence Layer
Async connection using Motor with resilient fallback to local memory
if MongoDB Atlas is unreachable.
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logger = logging.getLogger("vetbot.db")

_client: Optional[AsyncIOMotorClient] = None
_in_memory_conversations: Dict[str, List[Dict[str, Any]]] = {}

def get_mongo_client() -> Optional[AsyncIOMotorClient]:
    global _client
    if _client is not None:
        return _client

    uri = settings.MONGODB_URI
    if not uri:
        logger.warning("MONGODB_URI not configured. Using in-memory conversation storage.")
        return None

    try:
        _client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )
        logger.info("Connected to MongoDB Atlas client.")
        return _client
    except Exception as e:
        logger.error(f"Failed to initialize MongoDB client: {e}")
        return None

async def save_conversation_turn(
    session_id: str,
    user_message: str,
    assistant_message: str,
    sources: List[Dict[str, Any]],
    is_emergency: bool,
    intent: str,
    conversation_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Saves a conversation turn to MongoDB Atlas or local fallback.
    Returns the string ID of the conversation.
    """
    client = get_mongo_client()
    now = datetime.utcnow()

    turn_data = {
        "sessionId": session_id,
        "userMessage": user_message,
        "assistantMessage": assistant_message,
        "sources": sources,
        "isEmergency": is_emergency,
        "intent": intent,
        "metadata": metadata or {},
        "updatedAt": now,
    }

    if client:
        try:
            db = client[settings.MONGODB_DB_NAME]
            collection = db["conversations"]

            if conversation_id and ObjectId.is_valid(conversation_id):
                oid = ObjectId(conversation_id)
                await collection.update_one(
                    {"_id": oid},
                    {
                        "$push": {
                            "messages": {
                                "$each": [
                                    {"role": "user", "content": user_message, "timestamp": now},
                                    {"role": "assistant", "content": assistant_message, "sources": sources, "isEmergency": is_emergency, "timestamp": now},
                                ]
                            }
                        },
                        "$set": {
                            "intent": intent,
                            "isEmergency": is_emergency,
                            "updatedAt": now,
                        }
                    },
                    upsert=True
                )
                return str(oid)
            else:
                doc = {
                    "sessionId": session_id,
                    "intent": intent,
                    "isEmergency": is_emergency,
                    "messages": [
                        {"role": "user", "content": user_message, "timestamp": now},
                        {"role": "assistant", "content": assistant_message, "sources": sources, "isEmergency": is_emergency, "timestamp": now},
                    ],
                    "metadata": metadata or {},
                    "createdAt": now,
                    "updatedAt": now,
                }
                res = await collection.insert_one(doc)
                return str(res.inserted_id)
        except Exception as e:
            logger.warning(f"MongoDB write failed ({e}), saving to in-memory fallback.")

    # Fallback in-memory persistence
    conv_id = conversation_id or f"mem_{session_id}_{int(now.timestamp())}"
    if conv_id not in _in_memory_conversations:
        _in_memory_conversations[conv_id] = []
    _in_memory_conversations[conv_id].extend([
        {"role": "user", "content": user_message, "timestamp": now.isoformat()},
        {"role": "assistant", "content": assistant_message, "sources": sources, "isEmergency": is_emergency, "timestamp": now.isoformat()},
    ])
    return conv_id

async def get_recent_history(session_id: str, limit: int = 6) -> List[Dict[str, str]]:
    """
    Retrieves recent chat history for context in LangGraph.
    """
    client = get_mongo_client()
    if client:
        try:
            db = client[settings.MONGODB_DB_NAME]
            collection = db["conversations"]
            cursor = collection.find({"sessionId": session_id}).sort("updatedAt", -1).limit(1)
            docs = await cursor.to_list(length=1)
            if docs and "messages" in docs[0]:
                msgs = docs[0]["messages"][-limit:]
                return [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in msgs]
        except Exception as e:
            logger.warning(f"MongoDB read failed ({e}), falling back to in-memory.")

    # In-memory search
    for conv_id, msgs in _in_memory_conversations.items():
        if session_id in conv_id or True:
            return [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in msgs[-limit:]]
    return []

# ── Pet Profile Management (MongoDB Atlas 'pets' Collection) ──────────────────

_in_memory_pets: List[Dict[str, Any]] = []

async def save_pet_profile(owner_id: str, pet_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves a registered pet profile directly to MongoDB Atlas 'pets' collection.
    """
    client = get_mongo_client()
    now = datetime.utcnow()

    doc = {
        "ownerId": owner_id or "default_pet_owner",
        "name": pet_data.get("name", "").strip(),
        "species": pet_data.get("species", "dog").lower(),
        "breed": pet_data.get("breed"),
        "age": pet_data.get("age"),
        "weightKg": pet_data.get("weightKg"),
        "sex": pet_data.get("sex", "unknown"),
        "notes": pet_data.get("notes"),
        "createdAt": now,
        "updatedAt": now,
    }

    if client:
        try:
            db = client[settings.MONGODB_DB_NAME]
            collection = db["pets"]
            res = await collection.insert_one(doc)
            doc["_id"] = str(res.inserted_id)
            doc["createdAt"] = doc["createdAt"].isoformat()
            doc["updatedAt"] = doc["updatedAt"].isoformat()
            logger.info(f"Registered pet '{doc['name']}' saved to MongoDB Atlas collection 'pets'.")
            return doc
        except Exception as e:
            logger.warning(f"Failed to save pet to MongoDB Atlas ({e}), falling back to memory.")

    doc["_id"] = f"mem_pet_{int(now.timestamp())}"
    doc["createdAt"] = doc["createdAt"].isoformat()
    doc["updatedAt"] = doc["updatedAt"].isoformat()
    _in_memory_pets.insert(0, doc)
    return doc

async def get_pet_profiles(owner_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves all registered pets from MongoDB Atlas.
    """
    client = get_mongo_client()
    if client:
        try:
            db = client[settings.MONGODB_DB_NAME]
            collection = db["pets"]
            query = {"ownerId": owner_id} if owner_id and owner_id != "default_pet_owner" else {}
            cursor = collection.find(query).sort("createdAt", -1)
            docs = await cursor.to_list(length=50)

            # If filtered query returns nothing, retrieve all registered pets
            if not docs and query:
                cursor = collection.find({}).sort("createdAt", -1)
                docs = await cursor.to_list(length=50)

            results = []
            for d in docs:
                d["_id"] = str(d["_id"])
                if isinstance(d.get("createdAt"), datetime):
                    d["createdAt"] = d["createdAt"].isoformat()
                if isinstance(d.get("updatedAt"), datetime):
                    d["updatedAt"] = d["updatedAt"].isoformat()
                results.append(d)
            return results
        except Exception as e:
            logger.warning(f"Failed to query pets from MongoDB Atlas ({e}), using memory.")

    return _in_memory_pets

async def delete_pet_profile(pet_id: str) -> bool:
    """
    Deletes a registered pet by ID from MongoDB Atlas.
    """
    client = get_mongo_client()
    if client:
        try:
            db = client[settings.MONGODB_DB_NAME]
            collection = db["pets"]
            if ObjectId.is_valid(pet_id):
                res = await collection.delete_one({"_id": ObjectId(pet_id)})
            else:
                res = await collection.delete_one({"_id": pet_id})
            return res.deletedCount > 0
        except Exception as e:
            logger.warning(f"Failed to delete pet from MongoDB Atlas: {e}")

    global _in_memory_pets
    _in_memory_pets = [p for p in _in_memory_pets if p.get("_id") != pet_id]
    return True

async def get_active_pet(owner_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Returns the most recently registered pet to personalize LangGraph answers.
    """
    pets = await get_pet_profiles(owner_id)
    return pets[0] if pets else None
