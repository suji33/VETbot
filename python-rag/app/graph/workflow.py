"""
LangGraph Workflow Definition for VetBot
Assembles the complete state machine with conditional routing for emergencies,
intent-based RAG bypass, grounded answer synthesis, and safety gates.
"""
import logging
from langgraph.graph import StateGraph, END
from app.graph.state import VetBotState
from app.graph.nodes import (
    emergency_gate_node,
    emergency_response_node,
    question_analysis_node,
    document_retrieval_node,
    answer_generation_node,
    safety_validation_node,
)

logger = logging.getLogger("vetbot.workflow")

def route_after_emergency(state: VetBotState) -> str:
    """Routes directly to immediate triage response if emergency detected."""
    if state.get("is_emergency", False):
        return "emergency_response"
    return "question_analysis"

def route_after_analysis(state: VetBotState) -> str:
    """Bypasses retrieval if the query is non-clinical/conversational."""
    if state.get("requires_rag", True):
        return "document_retrieval"
    return "answer_generation"

def build_vetbot_graph():
    """Builds and compiles the VetBot StateGraph."""
    builder = StateGraph(VetBotState)

    # Register Nodes
    builder.add_node("emergency_gate", emergency_gate_node)
    builder.add_node("emergency_response", emergency_response_node)
    builder.add_node("question_analysis", question_analysis_node)
    builder.add_node("document_retrieval", document_retrieval_node)
    builder.add_node("answer_generation", answer_generation_node)
    builder.add_node("safety_validation", safety_validation_node)

    # Set Entry Point
    builder.set_entry_point("emergency_gate")

    # Conditional Routing from Emergency Gate
    builder.add_conditional_edges(
        "emergency_gate",
        route_after_emergency,
        {
            "emergency_response": "emergency_response",
            "question_analysis": "question_analysis",
        }
    )

    # Conditional Routing from Question Analysis
    builder.add_conditional_edges(
        "question_analysis",
        route_after_analysis,
        {
            "document_retrieval": "document_retrieval",
            "answer_generation": "answer_generation",
        }
    )

    # Linear Transitions
    builder.add_edge("emergency_response", END)
    builder.add_edge("document_retrieval", "answer_generation")
    builder.add_edge("answer_generation", "safety_validation")
    builder.add_edge("safety_validation", END)

    logger.info("Compiling VetBot LangGraph...")
    return builder.compile()

# Singleton compiled graph instance
vetbot_graph = build_vetbot_graph()
