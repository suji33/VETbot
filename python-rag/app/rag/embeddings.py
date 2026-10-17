import logging
from typing import List
from app.config import settings
from app.utils.http_client import post_with_retry

logger = logging.getLogger("vetbot.embeddings")

async def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding vector using the configured embedding model via OpenRouter.
    Matches the TypeScript implementation in ModelAdapter.ts.
    """
    payload = {
        "model": settings.EMBEDDING_MODEL,
        "input": text,
    }

    try:
        data = await post_with_retry("embeddings", payload, max_retries=3)
        res_data = data.get("data", [])
        if not res_data or "embedding" not in res_data[0]:
            raise ValueError(f"Invalid embedding response format: {data}")
        return res_data[0]["embedding"]
    except Exception as e:
        logger.error(f"Failed to generate embedding: {str(e)}")
        raise
