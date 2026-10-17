import logging
from typing import List, Dict, Any, Optional
from app.rag.schemas import IngestDocument
from app.rag.embeddings import generate_embedding
from app.rag.chunking import split_text_into_chunks
from app.rag.documents import DEFAULT_VET_DOCUMENTS

logger = logging.getLogger("vetbot.ingest")

async def ingest_documents(documents: Optional[List[IngestDocument]] = None) -> Dict[str, Any]:
    from app.rag.retriever import get_or_create_collection

    docs_to_ingest = documents if documents is not None else DEFAULT_VET_DOCUMENTS
    col = get_or_create_collection()

    ids: List[str] = []
    texts: List[str] = []
    embeddings: List[List[float]] = []
    metadatas: List[Dict[str, Any]] = []

    total_chunks = 0
    for doc in docs_to_ingest:
        chunks = split_text_into_chunks(doc.text, max_chunk_size=400, overlap=60)
        for idx, chunk in enumerate(chunks):
            chunk_id = f"{doc.id}-chunk-{idx}" if len(chunks) > 1 else doc.id
            try:
                emb = await generate_embedding(chunk)
                ids.append(chunk_id)
                texts.append(chunk)
                embeddings.append(emb)
                metadatas.append({
                    "source_title": doc.source_title,
                    "source_url": doc.source_url or "",
                    "category": doc.category,
                    "page_number": doc.page_number or 1,
                })
                total_chunks += 1
            except Exception as e:
                logger.warning(f"Failed to embed chunk {chunk_id}: {str(e)}")

    if not ids:
        return {"status": "error", "message": "No embeddings were generated", "count": 0}

    col.upsert(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    total_count = col.count()
    return {
        "status": "success",
        "ingestedChunks": total_chunks,
        "totalDocuments": total_count,
        "collection": col.name,
    }
