import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "models" in data
    assert "rag" in data

def test_nlp_analyze_validation_error():
    # Missing required message field
    response = client.post("/nlp/analyze", json={})
    assert response.status_code == 422

def test_rag_retrieve_validation_error():
    # Missing required query field
    response = client.post("/rag/retrieve", json={})
    assert response.status_code == 422

def test_rag_ingest_unauthorized():
    response = client.post("/rag/ingest", json={"apiKey": "wrong-secret"})
    assert response.status_code == 401
