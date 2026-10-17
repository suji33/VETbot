import asyncio
import logging
from typing import Any, Dict, List, Optional
import httpx
from app.config import settings

logger = logging.getLogger("vetbot.http")

def get_auth_headers() -> Dict[str, str]:
    api_key = settings.OPENROUTER_API_KEY.strip()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured.")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "PetCare AI (Python RAG)",
    }

async def post_with_retry(
    endpoint: str,
    payload: Dict[str, Any],
    max_retries: int = 3,
    timeout: float = 40.0,
) -> Dict[str, Any]:
    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/{endpoint.lstrip('/')}"
    headers = get_auth_headers()

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(1, max_retries + 1):
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code in (429, 502, 503, 504):
                    if attempt < max_retries:
                        delay = attempt * 2.0
                        logger.warning(
                            f"[OpenRouter {response.status_code}] Temporary upstream issue on {payload.get('model')}. "
                            f"Retrying in {delay}s (attempt {attempt}/{max_retries})..."
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        raise httpx.HTTPStatusError(
                            f"The free AI model ({payload.get('model')}) is currently busy upstream. Please try again shortly.",
                            request=response.request,
                            response=response,
                        )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (429, 502, 503, 504) and attempt < max_retries:
                    delay = attempt * 2.0
                    await asyncio.sleep(delay)
                    continue
                raise
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < max_retries:
                    await asyncio.sleep(attempt * 1.5)
                    continue
                raise RuntimeError(f"Network error communicating with AI model: {str(e)}") from e

    raise RuntimeError(f"Request to {url} failed after {max_retries} retries.")
