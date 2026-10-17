import pytest
from app.rag.chunking import split_text_into_chunks
from app.rag.retriever import bm25_rank
from app.rag.schemas import RetrievedPassage

def test_split_text_into_chunks_short():
    text = "Short clinical guide about canine nutrition."
    chunks = split_text_into_chunks(text, max_chunk_size=100)
    assert len(chunks) == 1
    assert chunks[0] == text

def test_split_text_into_chunks_long():
    text = (
        "Chocolate contains theobromine. Theobromine is toxic to dogs. "
        "Symptoms include tachycardia, vomiting, and tremors. "
        "Prompt veterinary attention is required. Immediate emesis may be indicated."
    )
    chunks = split_text_into_chunks(text, max_chunk_size=90, overlap=25)
    assert len(chunks) >= 2

def test_bm25_rank_keyword_matching():
    corpus = [
        "Chocolate toxicosis involves theobromine ingestion in canines.",
        "Feline urinary tract disease requires hydration.",
        "Canine vaccination schedules for puppies and adult dogs.",
    ]
    scores = bm25_rank("theobromine chocolate", corpus)
    assert len(scores) == 3
    # The first document should have the highest score
    assert scores[0] > scores[1]
    assert scores[0] > scores[2]

def test_retrieved_passage_camel_case_export():
    p = RetrievedPassage(
        id="vet-001",
        text="Sample clinical passage",
        sourceTitle="Merck Vet Manual",
        sourceUrl="https://merckvetmanual.com",
        category="toxicology",
        score=0.88,
        pageNumber=42,
    )
    dumped = p.model_dump(by_alias=True)
    assert dumped["sourceTitle"] == "Merck Vet Manual"
    assert dumped["sourceUrl"] == "https://merckvetmanual.com"
    assert dumped["pageNumber"] == 42
