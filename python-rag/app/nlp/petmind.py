import json
import logging
import re
from typing import Dict, List, Any
from app.config import settings
from app.nlp.schemas import ExtractedContext, AnalyzeRequest
from app.utils.http_client import post_with_retry

logger = logging.getLogger("vetbot.nlp")

SYSTEM_PROMPT = """You are PetMind NLP, the intent-detection module of PetCare AI.

Analyze the user's message and return a JSON object with this exact structure:

{
  "intent": "<one of: symptom_information | nutrition_question | reminder_create | reminder_list | reminder_cancel | pet_profile | general_care | conversation_history | greeting | unrelated>",
  "petSpecies": "<dog | cat | bird | rabbit | guinea pig | hamster | ferret | reptile | turtle | fish | horse | other | null>",
  "petName": "<string or null>",
  "symptoms": ["<symptom 1>", "<symptom 2>"],
  "duration": "<duration string or null>",
  "severity": "<mild | moderate | severe | unknown>",
  "missingInfo": ["<what is missing, e.g. age, species>"],
  "reminderDetails": {
    "type": "<feeding | vaccination | medication | followup | other>",
    "time": "<time string or null>",
    "frequency": "<daily | weekly | once | null>",
    "petName": "<string or null>"
  },
  "requiresVision": false,
  "requiresRag": true,
  "requiresReminderWorkflow": false,
  "followUpQuestion": "<suggested follow-up question or null>",
  "confidence": 0.85
}

RULES:
- requiresVision = true only if the user uploaded an image (indicated in message)
- requiresRag = true for symptom, nutrition, and general care questions
- requiresReminderWorkflow = true for reminder_create, reminder_cancel, reminder_list
- symptoms should be individual items, not combined
- Do NOT invent information that is not in the message
- If species is unclear, set petSpecies to null and add "species" to missingInfo
- confidence should reflect how clear the intent is (0.5 = ambiguous, 0.9 = clear)
- reminderDetails is only needed for reminder intents
- Respond ONLY with valid JSON. No markdown fences, no explanation."""

def clean_json_string(raw: str) -> str:
    cleaned = raw.strip()
    match = re.search(r'\{[\s\S]*\}', cleaned)
    if match:
        return match.group(0)
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    return cleaned.strip()

async def analyze_message(req: AnalyzeRequest) -> ExtractedContext:
    user_msg = (
        f"[User has attached an image] {req.message}"
        if req.has_image
        else req.message
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[
            {"role": h.get("role", "user"), "content": h.get("content", "")}
            for h in req.history[-4:]
        ],
        {"role": "user", "content": user_msg},
    ]

    payload = {
        "model": settings.CONVERSATION_MODEL,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": 800,
    }

    try:
        response = await post_with_retry("chat/completions", payload, max_retries=3)
        choices = response.get("choices", [])
        if not choices:
            raise ValueError("No choices returned from OpenRouter")

        msg = choices[0].get("message", {})
        raw_content = msg.get("content") or msg.get("reasoning") or ""
        if not raw_content:
            raise ValueError("Empty content from intent extraction model")

        cleaned = clean_json_string(raw_content)
        data = json.loads(cleaned)

        context = ExtractedContext.model_validate(data)
        if req.has_image:
            context.requires_vision = True

        return context
    except Exception as e:
        logger.warning(f"PetMind NLP model extraction failed: {str(e)}. Using safe fallback context.")
        msg_lower = req.message.lower()
        detected_sp = None
        for sp in ["cat", "dog", "bird", "parrot", "rabbit", "bunny", "guinea pig", "hamster", "ferret", "reptile", "turtle", "fish", "horse"]:
            if sp in msg_lower:
                detected_sp = "rabbit" if sp == "bunny" else ("bird" if sp == "parrot" else sp)
                break
        return ExtractedContext(
            intent="general_care",
            pet_species=detected_sp,
            requires_vision=req.has_image,
            requires_rag=True,
            requires_reminder_workflow=False,
            confidence=0.5 if detected_sp else 0.3,
            missing_info=["species"] if not detected_sp else []
        )
