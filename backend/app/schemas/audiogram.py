from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from app.models.audiogram import TypeAudiogramme


class AudiogramCreate(BaseModel):
    patient_id: UUID
    type: TypeAudiogramme = TypeAudiogramme.TONAL
    date_mesure: date
    seuils_od_ca: Optional[dict] = None
    seuils_od_co: Optional[dict] = None
    seuils_og_ca: Optional[dict] = None
    seuils_og_co: Optional[dict] = None
    vocal_od_intelligibilite: Optional[float] = None
    vocal_og_intelligibilite: Optional[float] = None
    vocal_od_sds: Optional[float] = None
    vocal_og_sds: Optional[float] = None
    tymp_od: Optional[str] = None
    tymp_og: Optional[str] = None
    reflexes_od: Optional[dict] = None
    reflexes_og: Optional[dict] = None
    oea_od_present: Optional[str] = None
    oea_og_present: Optional[str] = None
    commentaire: Optional[str] = None


class AudiogramRead(AudiogramCreate):
    id: UUID
    noah_session_id: Optional[str]
    perte_moyenne_od: Optional[float] = None
    perte_moyenne_og: Optional[float] = None
    classification_od: Optional[str] = None
    classification_og: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
