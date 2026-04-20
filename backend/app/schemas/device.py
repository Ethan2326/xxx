from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.device import CoteAppareillage, StatutAppareil


class DeviceCatalogRead(BaseModel):
    id: UUID
    fabricant: str
    marque: str
    modele: str
    reference: str
    ean: Optional[str]
    type_appareil: Optional[str]
    niveau_technologie: Optional[str]
    prix_achat_ht: Optional[float]
    prix_vente_conseille: Optional[float]
    classe_lpp: Optional[int]
    caracteristiques: Optional[dict]
    edi_code: Optional[str]

    model_config = {"from_attributes": True}


class HearingDeviceCreate(BaseModel):
    patient_id: UUID
    catalog_id: Optional[UUID] = None
    cote: CoteAppareillage
    statut: StatutAppareil = StatutAppareil.EN_ESSAI
    numero_serie: Optional[str] = None
    prix_vente_ht: Optional[float] = None
    base_remboursement: Optional[float] = None
    remboursement_secu: Optional[float] = None
    remboursement_mutuelle: Optional[float] = None
    reste_a_charge: Optional[float] = None
    notes_sav: Optional[str] = None


class HearingDeviceRead(HearingDeviceCreate):
    id: UUID
    date_attribution: Optional[datetime]
    date_fin_garantie: Optional[datetime]
    reste_a_charge: Optional[float]
    created_at: datetime
    catalog: Optional[DeviceCatalogRead] = None

    model_config = {"from_attributes": True}
