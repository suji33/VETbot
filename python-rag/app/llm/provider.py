"""
LLM Provider Abstraction
Allows seamless switching between Google Gemini and OpenRouter models,
supporting distinct roles (analysis, answer generation, safety reviewer)
with automatic retry and error handling.
"""
import logging
from typing import Optional, Any
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from app.config import settings

logger = logging.getLogger("vetbot.llm")

def get_chat_model(
    role: str = "answer",
    provider: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 800,
) -> BaseChatModel:
    """
    Factory function to instantiate the appropriate chat model.
    
    Roles:
      - 'analysis': Fast, low-latency model for intent and entity extraction
      - 'answer': High reasoning capability for grounded veterinary answers
      - 'reviewer': Safety and dosage auditing model
    """
    selected_provider = (provider or settings.LLM_PROVIDER).lower()

    # 1. Google Gemini Provider
    if selected_provider in ("google", "gemini"):
        api_key = settings.GOOGLE_API_KEY
        if api_key:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                model_name = settings.GEMINI_MODEL
                logger.info(f"Using Google Gemini model: {model_name} for role: {role}")
                return ChatGoogleGenerativeAI(
                    model=model_name,
                    google_api_key=api_key,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize ChatGoogleGenerativeAI ({e}), falling back to OpenRouter.")
        else:
            logger.info("GOOGLE_API_KEY not provided, using OpenRouter provider.")

    # 2. OpenRouter Provider (Default)
    api_key = settings.OPENROUTER_API_KEY
    base_url = settings.OPENROUTER_BASE_URL

    if role == "analysis":
        model_name = settings.CONVERSATION_MODEL
    elif role == "vision":
        model_name = getattr(settings, "VISION_MODEL", "nvidia/nemotron-3.5-super-vl:free")
    elif role == "reviewer":
        model_name = getattr(settings, "REVIEWER_MODEL", settings.ANSWER_MODEL)
    else:
        model_name = settings.ANSWER_MODEL

    logger.info(f"Using OpenRouter model: {model_name} for role: {role}")
    return ChatOpenAI(
        model=model_name,
        openai_api_key=api_key or "dummy_key",
        openai_api_base=base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        max_retries=2,
        request_timeout=30.0,
        default_headers={
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "PetCare AI VetBot",
        },
    )
