import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"[VETbot] Starting PetCare AI Python NLP & RAG Service on http://{settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
        log_level="info",
    )
