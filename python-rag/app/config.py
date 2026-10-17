import os
from pathlib import Path
from dotenv import load_dotenv

# Locate backend .env if available, or fall back to local
BACKEND_ENV = Path(__file__).resolve().parent.parent.parent / "backend" / ".env"
LOCAL_ENV = Path(__file__).resolve().parent.parent / ".env"

env_file = BACKEND_ENV if BACKEND_ENV.exists() else (LOCAL_ENV if LOCAL_ENV.exists() else None)
if env_file:
    load_dotenv(dotenv_path=env_file)

class Settings:
    PYTHON_RAG_PORT: int = int(os.getenv("PYTHON_RAG_PORT", "8002"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    @property
    def PORT(self) -> int:
        return self.PYTHON_RAG_PORT

    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    CONVERSATION_MODEL: str = os.getenv("CONVERSATION_MODEL", "google/gemma-4-26b-a4b-it:free")
    ANSWER_MODEL: str = os.getenv("ANSWER_MODEL", "google/gemma-4-26b-a4b-it:free")
    VISION_MODEL: str = os.getenv("VISION_MODEL", "nvidia/nemotron-3.5-super-vl:free")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "openai/text-embedding-3-small")

    CHROMADB_URL: str = os.getenv("CHROMADB_URL", "http://localhost:8000")
    CHROMA_COLLECTION: str = os.getenv("CHROMA_COLLECTION", "vetknowledge")

    # LLM Provider Configuration: 'openrouter' or 'gemini'
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openrouter").lower()
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    # MongoDB Atlas
    MONGODB_URI: str = os.getenv("MONGODB_URI", "")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "petcareai")

    # LangSmith Observability & Tracing
    LANGCHAIN_TRACING_V2: str = os.getenv("LANGCHAIN_TRACING_V2", "false")
    LANGCHAIN_API_KEY: str = os.getenv("LANGCHAIN_API_KEY", "")
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "vetbot-langgraph")

    # API Security
    API_KEY_PROTECTION: bool = os.getenv("API_KEY_PROTECTION", "false").lower() == "true"
    CLIENT_API_KEY: str = os.getenv("CLIENT_API_KEY", "vetbot-client-secret")
    INGEST_API_KEY: str = os.getenv("INGEST_API_KEY", "vetbot-internal-secret")

settings = Settings()

