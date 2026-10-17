import re
from typing import List, Dict, Any

def split_text_into_chunks(
    text: str,
    max_chunk_size: int = 500,
    overlap: int = 100,
) -> List[str]:
    """
    Split text into chunks with word/sentence boundary preservation.
    """
    cleaned = re.sub(r'\s+', ' ', text).strip()
    if len(cleaned) <= max_chunk_size:
        return [cleaned]

    sentences = re.split(r'(?<=[.!?])\s+', cleaned)
    chunks: List[str] = []
    current_chunk: List[str] = []
    current_len = 0

    for sentence in sentences:
        s_len = len(sentence)
        if current_len + s_len > max_chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            # Create overlap
            overlap_chunk = []
            overlap_len = 0
            for prev_s in reversed(current_chunk):
                if overlap_len + len(prev_s) <= overlap:
                    overlap_chunk.insert(0, prev_s)
                    overlap_len += len(prev_s)
                else:
                    break
            current_chunk = overlap_chunk
            current_len = overlap_len

        current_chunk.append(sentence)
        current_len += s_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks
