from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class SituationRecommendation(BaseModel):
    situation_key: str
    situation_label: str
    description: str
    parametres_suggeres: dict
    recommandation_texte: str
    priorite: int  # 1=haute, 2=moyenne, 3=faible


class FittingSessionCreate(BaseModel):
    patient_id: UUID
    noah_session_id: Optional[str] = None
    parametres_avant: Optional[dict] = None
    notes: Optional[str] = None


class FittingAIRequest(BaseModel):
    patient_id: UUID
    session_id: UUID
    situation_key: str
    feedback_patient: Optional[str] = None
    parametres_actuels: Optional[dict] = None
    contexte: Optional[str] = None


class FittingSessionRead(BaseModel):
    id: UUID
    patient_id: UUID
    user_id: UUID
    noah_session_id: Optional[str]
    date_session: datetime
    parametres_avant: Optional[dict]
    parametres_apres: Optional[dict]
    situations_testees: Optional[list]
    recommandations_ia: Optional[str]
    satisfaction_patient: Optional[float]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    patient_context: Optional[dict] = None  # contexte optionnel du patient
