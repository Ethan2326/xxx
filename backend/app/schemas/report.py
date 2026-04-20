from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.report import TypeCompteRendu, StatutCompteRendu


class ReportCreate(BaseModel):
    patient_id: UUID
    audiogram_id: Optional[UUID] = None
    type: TypeCompteRendu
    titre: str
    prescripteur_nom: Optional[str] = None
    prescripteur_rpps: Optional[str] = None
    prescripteur_specialite: Optional[str] = None
    contenu_json: Optional[str] = None


class ReportUpdate(BaseModel):
    titre: Optional[str] = None
    statut: Optional[StatutCompteRendu] = None
    prescripteur_nom: Optional[str] = None
    prescripteur_rpps: Optional[str] = None
    prescripteur_specialite: Optional[str] = None
    contenu_json: Optional[str] = None
    contenu_html: Optional[str] = None


class ReportRead(BaseModel):
    id: UUID
    patient_id: UUID
    author_id: UUID
    audiogram_id: Optional[UUID]
    type: TypeCompteRendu
    statut: StatutCompteRendu
    titre: str
    prescripteur_nom: Optional[str]
    prescripteur_rpps: Optional[str]
    prescripteur_specialite: Optional[str]
    contenu_json: Optional[str]
    contenu_html: Optional[str]
    date_redaction: datetime
    date_envoi: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportGenerateRequest(BaseModel):
    patient_id: UUID
    audiogram_id: Optional[UUID] = None
    type: TypeCompteRendu
    prescripteur_nom: Optional[str] = None
    prescripteur_specialite: Optional[str] = None
    contexte_supplementaire: Optional[str] = None
