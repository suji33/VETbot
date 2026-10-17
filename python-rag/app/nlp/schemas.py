from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

IntentType = Literal[
    'symptom_information',
    'emergency',
    'nutrition_question',
    'reminder_create',
    'reminder_list',
    'reminder_cancel',
    'pet_profile',
    'general_care',
    'conversation_history',
    'greeting',
    'unrelated',
]

class ReminderDetails(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    type: str = "other"
    time: Optional[str] = None
    frequency: Optional[str] = None
    pet_name: Optional[str] = Field(None, alias="petName")

class ExtractedContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    intent: IntentType = "general_care"
    pet_species: Optional[str] = Field(None, alias="petSpecies")
    pet_name: Optional[str] = Field(None, alias="petName")
    symptoms: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    severity: Optional[Literal['mild', 'moderate', 'severe', 'unknown']] = "unknown"
    missing_info: List[str] = Field(default_factory=list, alias="missingInfo")
    reminder_details: Optional[ReminderDetails] = Field(None, alias="reminderDetails")
    requires_vision: bool = Field(False, alias="requiresVision")
    requires_rag: bool = Field(True, alias="requiresRag")
    requires_reminder_workflow: bool = Field(False, alias="requiresReminderWorkflow")
    follow_up_question: Optional[str] = Field(None, alias="followUpQuestion")
    confidence: float = 0.85

class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    has_image: bool = Field(False, alias="hasImage")
