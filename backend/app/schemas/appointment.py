from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.appointment import TypeRdv, StatutRdv


class AppointmentCreate(BaseModel):
    patient_id: UUID
    user_id: UUID
    type: TypeRdv
    debut: datetime
    fin: datetime
    salle: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    statut: Optional[StatutRdv] = None
    debut: Optional[datetime] = None
    fin: Optional[datetime] = None
    salle: Optional[str] = None
    notes: Optional[str] = None


class AppointmentRead(BaseModel):
    id: UUID
    patient_id: UUID
    user_id: UUID
    type: TypeRdv
    statut: StatutRdv
    debut: datetime
    fin: datetime
    duree_minutes: int
    salle: Optional[str]
    notes: Optional[str]
    rappel_envoye: bool
    created_at: datetime

    model_config = {"from_attributes": True}
