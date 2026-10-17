"""
VetBot AI Backend - FastAPI with LangGraph, LangSmith, and MongoDB Atlas
Provides full-featured endpoints compatible with the React frontend and Node.js orchestrator.
"""
import logging
import base64
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.graph.workflow import vetbot_graph
from app.db.mongo import (
    save_conversation_turn,
    get_recent_history,
    save_pet_profile,
    get_pet_profiles,
    delete_pet_profile,
    get_active_pet,
)
from app.evaluation.langsmith_eval import run_evaluation_benchmark
from app.nlp.schemas import AnalyzeRequest, ExtractedContext
from app.nlp.petmind import analyze_message
from app.rag.schemas import RetrieveRequest, RetrievedPassage, IngestRequest, RagHealthResponse
from app.rag.retriever import retrieve_passages, check_health
from app.rag.ingest import ingest_documents

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("vetbot.api")
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🐾 [AutoTrainer] Starting VetBot Multi-Species Knowledge & NLP Auto-Training on boot...")
    try:
        from app.rag.ingest import ingest_documents
        from app.rag.documents import DEFAULT_VET_DOCUMENTS
        res = await ingest_documents(DEFAULT_VET_DOCUMENTS)
        logger.info(f"✅ [AutoTrainer] Multi-species knowledge auto-trained: {res.get('totalDocuments', 0)} documents active across all pets.")
    except Exception as e:
        logger.warning(f"⚠️ [AutoTrainer] Auto-training notice on boot: {e}")
    yield
    logger.info("VetBot FastAPI shutting down.")

app = FastAPI(
    title="VetBot AI - LangGraph & LangSmith Veterinary Assistant",
    description="Python FastAPI backend powered by LangGraph, LangSmith observability, hybrid RAG, and MongoDB Atlas.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Key Security Dependency ───────────────────────────────────────────────
def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if settings.API_KEY_PROTECTION:
        if not x_api_key or x_api_key != settings.CLIENT_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key header.")
    return True

# ── Frontend-Compatible Request / Response Schemas ───────────────────────────
class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str
    session_id: str = Field(..., alias="sessionId")
    conversation_id: Optional[str] = Field(None, alias="conversationId")
    pet_species: Optional[str] = Field(None, alias="petSpecies")
    pet_name: Optional[str] = Field(None, alias="petName")
    timezone: Optional[str] = "Asia/Kolkata"

class ChatResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    conversation_id: str = Field(alias="conversationId")
    answer: str
    sources: List[Dict[str, Any]] = []
    is_emergency: bool = Field(alias="isEmergency")
    intent: str
    processing_steps: List[str] = Field(default_factory=list, alias="processingSteps")
    safety_warnings: List[str] = Field(default_factory=list, alias="safetyWarnings")

# ── Health & Diagnostics ──────────────────────────────────────────────────────
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    rag_info = check_health()
    return {
        "status": "ok",
        "service": "VetBot Python LangGraph & LangSmith Engine",
        "llmProvider": settings.LLM_PROVIDER,
        "models": {
            "conversation": settings.CONVERSATION_MODEL,
            "answer": settings.ANSWER_MODEL,
            "gemini": settings.GEMINI_MODEL,
            "embedding": settings.EMBEDDING_MODEL,
        },
        "rag": rag_info,
        "mongoConnected": bool(settings.MONGODB_URI),
        "langsmithTracing": settings.LANGCHAIN_TRACING_V2 == "true",
    }

# ── Core LangGraph Chat Endpoint (React Frontend Drop-In) ─────────────────────
@app.post("/api/chat", response_model=ChatResponse)
async def api_chat(
    req: ChatRequest,
    _auth: bool = Depends(verify_api_key),
) -> ChatResponse:
    """
    Executes the full VetBot LangGraph state machine:
    1. Emergency Gate (Instant triage check)
    2. Question Analysis (PetMind intent & entity extraction)
    3. Document Retrieval (Hybrid ChromaDB + BM25)
    4. Answer Generation (Evidence-grounded, non-diagnostic synthesis)
    5. Safety Validation (Dosage suppression & disclaimer enforcement)
    6. MongoDB Atlas Persistence
    """
    logger.info(f"LangGraph Chat invocation from session '{req.session_id}': '{req.message[:60]}...'")

    # Check for registered pet in MongoDB Atlas to personalize consultation
    active_pet = None
    pet_species = req.pet_species
    pet_name = req.pet_name
    if not pet_species or not pet_name:
        active_pet = await get_active_pet(req.session_id)
        if active_pet:
            pet_species = pet_species or active_pet.get("species")
            pet_name = pet_name or active_pet.get("name")

    initial_state = {
        "session_id": req.session_id,
        "conversation_id": req.conversation_id,
        "message": req.message,
        "pet_species": pet_species,
        "pet_name": pet_name,
        "pet_profile": active_pet,
        "image_data": None,
        "is_emergency": False,
        "emergency_reason": None,
        "intent": "general_care",
        "symptoms": [],
        "requires_rag": True,
        "query_for_rag": req.message,
        "retrieved_passages": [],
        "draft_answer": "",
        "final_answer": "",
        "sources": [],
        "safety_warnings": [],
        "processing_steps": [],
    }

    try:
        final_state = vetbot_graph.invoke(initial_state)

        # Persist conversation turn to MongoDB Atlas
        conv_id = await save_conversation_turn(
            session_id=req.session_id,
            user_message=req.message,
            assistant_message=final_state.get("final_answer", ""),
            sources=final_state.get("sources", []),
            is_emergency=final_state.get("is_emergency", False),
            intent=final_state.get("intent", "general_care"),
            conversation_id=req.conversation_id,
        )

        return ChatResponse(
            conversationId=conv_id,
            answer=final_state.get("final_answer", ""),
            sources=final_state.get("sources", []),
            isEmergency=final_state.get("is_emergency", False),
            intent=final_state.get("intent", "general_care"),
            processingSteps=final_state.get("processing_steps", []),
            safetyWarnings=final_state.get("safety_warnings", []),
        )
    except Exception as e:
        logger.error(f"LangGraph execution failure: {str(e)}")
        raise HTTPException(status_code=500, detail=f"VetBot pipeline error: {str(e)}")

# ── Multimodal Image Endpoint ─────────────────────────────────────────────────
@app.post("/api/chat/image", response_model=ChatResponse)
async def api_chat_image(
    image: UploadFile = File(...),
    message: str = Form("Please examine this image and provide observations."),
    sessionId: str = Form(...),
    conversationId: Optional[str] = Form(None),
    _auth: bool = Depends(verify_api_key),
) -> ChatResponse:
    """
    Multimodal image processing node: reads image buffer, parses clinical details,
    and executes LangGraph with image context.
    """
    logger.info(f"Received image upload for session '{sessionId}': {image.filename} ({image.content_type})")
    content = await image.read()
    b64_img = base64.b64encode(content).decode("utf-8")

    initial_state = {
        "session_id": sessionId,
        "conversation_id": conversationId,
        "message": message,
        "pet_species": None,
        "pet_name": None,
        "pet_profile": None,
        "image_data": f"data:{image.content_type};base64,{b64_img}",
        "is_emergency": False,
        "emergency_reason": None,
        "intent": "dermatology_inspection",
        "symptoms": ["visible lesion/rash/dermal change"],
        "requires_rag": True,
        "query_for_rag": f"image findings {message}",
        "retrieved_passages": [],
        "draft_answer": "",
        "final_answer": "",
        "sources": [],
        "safety_warnings": [],
        "processing_steps": ["Image Received & Decoded ✓"],
    }

    final_state = vetbot_graph.invoke(initial_state)

    conv_id = await save_conversation_turn(
        session_id=sessionId,
        user_message=f"[Attached Image: {image.filename}] {message}",
        assistant_message=final_state.get("final_answer", ""),
        sources=final_state.get("sources", []),
        is_emergency=final_state.get("is_emergency", False),
        intent="image_analysis",
        conversation_id=conversationId,
    )

    return ChatResponse(
        conversationId=conv_id,
        answer=final_state.get("final_answer", ""),
        sources=final_state.get("sources", []),
        isEmergency=final_state.get("is_emergency", False),
        intent="image_analysis",
        processingSteps=final_state.get("processing_steps", []),
        safetyWarnings=final_state.get("safety_warnings", []),
    )

# ── LangSmith Evaluation Benchmark Trigger ────────────────────────────────────
@app.post("/api/eval/run")
async def run_eval() -> Dict[str, Any]:
    """
    Runs automated evaluation benchmark measuring Answer Relevance, Factual Grounding,
    Retrieval Quality, and Safety Compliance.
    """
    report = run_evaluation_benchmark()
    return report

# ── MongoDB Conversation History ──────────────────────────────────────────────
@app.get("/api/conversations/{session_id}")
async def get_history(session_id: str) -> Dict[str, Any]:
    history = await get_recent_history(session_id)
    return {"sessionId": session_id, "messages": history}

# ── Pet Profiles Endpoints (MongoDB Atlas 'pets' Collection) ───────────────────
class PetRegistrationRequest(BaseModel):
    name: str
    species: Optional[str] = "dog"
    breed: Optional[str] = None
    age: Optional[int] = None
    weightKg: Optional[float] = None
    sex: Optional[str] = "unknown"
    notes: Optional[str] = None

@app.get("/api/pets")
async def get_all_pets(
    x_session_id: Optional[str] = Header(None, alias="x-session-id"),
) -> Dict[str, Any]:
    pets = await get_pet_profiles(x_session_id)
    return {"pets": pets}

@app.post("/api/pets")
async def create_pet(
    req: PetRegistrationRequest,
    x_session_id: Optional[str] = Header(None, alias="x-session-id"),
) -> Dict[str, Any]:
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Pet name is required.")
    pet = await save_pet_profile(x_session_id or "default_pet_owner", req.model_dump())
    return pet

@app.delete("/api/pets/{pet_id}")
async def remove_pet(pet_id: str) -> Dict[str, Any]:
    success = await delete_pet_profile(pet_id)
    if not success:
        raise HTTPException(status_code=404, detail="Pet not found.")
    return {"success": True}

# ── Microservice Legacy & Direct Endpoints ─────────────────────────────────────
@app.post("/nlp/analyze", response_model=ExtractedContext)
async def nlp_analyze(request: AnalyzeRequest) -> ExtractedContext:
    return await analyze_message(request)

@app.post("/rag/retrieve", response_model=List[RetrievedPassage])
async def rag_retrieve(request: RetrieveRequest) -> List[RetrievedPassage]:
    return await retrieve_passages(request)

@app.post("/rag/ingest")
async def rag_ingest(
    request: IngestRequest,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
) -> Dict[str, Any]:
    effective_key = request.api_key or x_api_key
    if effective_key != settings.INGEST_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid Ingest API Key.")
    return await ingest_documents(request.documents)
