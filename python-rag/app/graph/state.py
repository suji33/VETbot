"""
LangGraph State Schema for VetBot
"""
from typing import TypedDict, List, Dict, Optional, Any

class VetBotState(TypedDict):
    session_id: str
    conversation_id: Optional[str]
    message: str
    pet_species: Optional[str]
    pet_name: Optional[str]
    pet_profile: Optional[Dict[str, Any]]
    image_data: Optional[str]

    # Deterministic emergency triage
    is_emergency: bool
    emergency_reason: Optional[str]

    # NLP Analysis
    intent: str
    symptoms: List[str]
    requires_rag: bool
    query_for_rag: str

    # Retrieval
    retrieved_passages: List[Dict[str, Any]]

    # Synthesis & Safety
    draft_answer: str
    final_answer: str
    sources: List[Dict[str, Any]]
    safety_warnings: List[str]
    processing_steps: List[str]
