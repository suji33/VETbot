from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class RetrievedPassage(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    text: str
    source_title: str = Field(alias="sourceTitle")
    source_url: Optional[str] = Field(None, alias="sourceUrl")
    category: str
    score: float
    page_number: Optional[int] = Field(None, alias="pageNumber")

class RetrieveRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query: str
    filter_category: Optional[str] = Field(None, alias="filterCategory")
    top_k: int = Field(5, alias="topK")
    min_score: float = Field(0.3, alias="minScore")
    use_bm25: bool = Field(True, alias="useBm25")

class IngestDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    text: str
    source_title: str = Field(alias="sourceTitle")
    source_url: Optional[str] = Field(None, alias="sourceUrl")
    category: str
    page_number: Optional[int] = Field(None, alias="pageNumber")

class IngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    documents: Optional[List[IngestDocument]] = None
    api_key: Optional[str] = Field(None, alias="apiKey")

class RagHealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    available: bool
    document_count: int = Field(alias="documentCount")
    collection_name: str = Field(alias="collectionName")
