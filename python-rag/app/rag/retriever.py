import logging
import re
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
import chromadb
from chromadb.config import Settings as ChromaSettings
from rank_bm25 import BM25Okapi

from app.config import settings
from app.rag.schemas import RetrievedPassage, RetrieveRequest
from app.rag.embeddings import generate_embedding
from app.rag.documents import DEFAULT_VET_DOCUMENTS

logger = logging.getLogger("vetbot.retriever")

_chroma_client: Optional[chromadb.ClientAPI] = None
_collection: Optional[chromadb.Collection] = None

def get_chroma_client() -> chromadb.ClientAPI:
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    url = settings.CHROMADB_URL.strip()
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 8000

    try:
        _chroma_client = chromadb.HttpClient(host=host, port=port)
        # Test connection
        _chroma_client.heartbeat()
        return _chroma_client
    except Exception as e:
        logger.warning(f"ChromaDB HttpClient connection to {url} failed: {e}. Falling back to PersistentClient.")
        # Fallback to local persistent storage for development/testing if external Chroma is not up
        _chroma_client = chromadb.PersistentClient(path="./chroma_db_data")
        return _chroma_client

def get_or_create_collection() -> chromadb.Collection:
    global _collection
    if _collection is not None:
        return _collection

    client = get_chroma_client()
    _collection = client.get_or_create_collection(
        name=settings.CHROMA_COLLECTION,
        metadata={"description": "Veterinary clinical knowledge embeddings for PetCare AI (Python)"}
    )
    return _collection

def bm25_rank(query: str, corpus: List[str]) -> List[float]:
    """Calculate normalized BM25 keyword scores for a corpus."""
    if not corpus:
        return []
    tokenized_corpus = [re.findall(r'\w+', doc.lower()) for doc in corpus]
    bm25 = BM25Okapi(tokenized_corpus)
    tokenized_query = re.findall(r'\w+', query.lower())
    scores = bm25.get_scores(tokenized_query)
    max_score = max(scores) if len(scores) > 0 and max(scores) > 0 else 1.0
    return [s / max_score for s in scores]

async def retrieve_passages(req: RetrieveRequest) -> List[RetrievedPassage]:
    try:
        col = get_or_create_collection()
    except Exception as e:
        logger.error(f"RAG: ChromaDB unavailable — {str(e)}")
        return []

    # Check if collection is empty, and seed default veterinary documents if needed
    try:
        count = col.count()
        if count == 0:
            logger.info("RAG: Collection empty. Seeding default veterinary documents...")
            from app.rag.ingest import ingest_documents
            await ingest_documents(DEFAULT_VET_DOCUMENTS)
    except Exception as e:
        logger.warning(f"RAG: Seeding check failed: {e}")

    try:
        query_embedding = await generate_embedding(req.query)
    except Exception as e:
        logger.error(f"RAG: Embedding generation failed — {str(e)}")
        return []

    where_clause = (
        {"category": {"$eq": req.filter_category}}
        if req.filter_category
        else None
    )

    try:
        results = col.query(
            query_embeddings=[query_embedding],
            n_results=req.top_k,
            where=where_clause,
            include=["documents", "metadatas", "distances"],
        )

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]

        passages: List[RetrievedPassage] = []
        raw_docs = []

        for i in range(len(docs)):
            doc = docs[i]
            meta = metas[i] if i < len(metas) else {}
            dist = distances[i] if i < len(distances) else 1.0
            pid = ids[i] if i < len(ids) else f"doc-{i}"

            if not doc:
                continue

            # ChromaDB returns L2 distance; convert to 0-1 similarity
            score = max(0.0, 1.0 - (dist / 2.0))
            if score < req.min_score:
                continue

            raw_docs.append(doc)
            passages.append(
                RetrievedPassage(
                    id=str(pid),
                    text=doc,
                    sourceTitle=meta.get("source_title", "Veterinary Reference"),
                    sourceUrl=meta.get("source_url"),
                    category=meta.get("category", "general"),
                    pageNumber=meta.get("page_number"),
                    score=round(score, 2),
                )
            )

        # Hybrid BM25 re-weighting if enabled
        if req.use_bm25 and passages:
            bm25_scores = bm25_rank(req.query, raw_docs)
            for idx, p in enumerate(passages):
                bm25_val = bm25_scores[idx] if idx < len(bm25_scores) else 0.0
                # Hybrid weight: 70% dense semantic embedding + 30% exact keyword BM25
                hybrid_score = (0.7 * p.score) + (0.3 * bm25_val)
                p.score = round(hybrid_score, 2)

        passages.sort(key=lambda x: x.score, reverse=True)
        return passages

    except Exception as e:
        logger.error(f"RAG: ChromaDB query failed — {str(e)}")
        return []

def check_health() -> Dict[str, Any]:
    try:
        col = get_or_create_collection()
        count = col.count()
        return {
            "available": True,
            "documentCount": count,
            "collectionName": settings.CHROMA_COLLECTION,
        }
    except Exception as e:
        return {
            "available": False,
            "documentCount": 0,
            "collectionName": settings.CHROMA_COLLECTION,
            "error": str(e),
        }
