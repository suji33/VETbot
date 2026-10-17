import pytest
from app.nlp.schemas import ExtractedContext, AnalyzeRequest
from app.nlp.petmind import clean_json_string

def test_clean_json_string_with_markdown_fences():
    raw = "```json\n{\"intent\": \"symptom_information\", \"confidence\": 0.9}\n```"
    cleaned = clean_json_string(raw)
    assert cleaned == '{"intent": "symptom_information", "confidence": 0.9}'

def test_clean_json_string_with_extra_text():
    raw = "Here is the response:\n{\"intent\": \"general_care\"}\nHope this helps!"
    cleaned = clean_json_string(raw)
    assert cleaned == '{"intent": "general_care"}'

def test_extracted_context_camel_case_serialization():
    ctx = ExtractedContext(
        intent="symptom_information",
        petSpecies="dog",
        petName="Max",
        symptoms=["itching", "red skin"],
        requiresVision=True,
        requiresRag=True,
        requiresReminderWorkflow=False,
        confidence=0.92,
    )
    data = ctx.model_dump(by_alias=True)
    assert data["petSpecies"] == "dog"
    assert data["petName"] == "Max"
    assert data["requiresVision"] is True
    assert data["requiresRag"] is True
    assert "itching" in data["symptoms"]

def test_analyze_request_deserialization():
    req = AnalyzeRequest.model_validate({
        "message": "My cat is vomiting yellow foam",
        "hasImage": False,
        "history": []
    })
    assert req.message == "My cat is vomiting yellow foam"
    assert req.has_image is False
