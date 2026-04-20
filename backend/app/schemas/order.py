from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.order import StatutCommande, TypeCommande


class OrderItemCreate(BaseModel):
    catalog_id: Optional[UUID] = None
    reference: str
    designation: str
    quantite: int = 1
    prix_unitaire_ht: Optional[float] = None
    remise_pct: float = 0.0
    motif_sav: Optional[str] = None
    numero_serie: Optional[str] = None


class OrderItemRead(OrderItemCreate):
    id: UUID
    montant_ht: Optional[float]

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    patient_id: Optional[UUID] = None
    type: TypeCommande = TypeCommande.NEUF
    fabricant: str
    date_livraison_souhaitee: Optional[datetime] = None
    adresse_livraison: Optional[str] = None
    notes: Optional[str] = None
    items: List[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    statut: Optional[StatutCommande] = None
    date_livraison_reelle: Optional[datetime] = None
    edi_reference_fournisseur: Optional[str] = None
    notes: Optional[str] = None


class OrderRead(BaseModel):
    id: UUID
    numero_commande: str
    patient_id: Optional[UUID]
    type: TypeCommande
    statut: StatutCommande
    fabricant: str
    edi_message_id: Optional[str]
    edi_sent_at: Optional[datetime]
    edi_confirmed_at: Optional[datetime]
    edi_reference_fournisseur: Optional[str]
    date_livraison_souhaitee: Optional[datetime]
    date_livraison_reelle: Optional[datetime]
    montant_ht: float
    montant_tva: float
    montant_ttc: float
    notes: Optional[str]
    items: List[OrderItemRead] = []
    created_at: datetime

    model_config = {"from_attributes": True}
