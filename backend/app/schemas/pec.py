from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from app.models.pec import StatutPEC, MethodePEC, TypeDemande


class DocumentPECCreate(BaseModel):
    type_document: str  # devis | ordonnance | carte_mutuelle | audiogramme | autre
    nom_fichier: str
    mime_type: str = "application/pdf"
    contenu: Optional[str] = None  # base64


class DocumentPECRead(BaseModel):
    id: UUID
    pec_id: UUID
    type_document: str
    nom_fichier: str
    mime_type: str
    taille_octets: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class PECCreate(BaseModel):
    patient_id: UUID
    mutuelle_nom: str
    reseau_tiers_payant: Optional[str] = None
    numero_adherent: Optional[str] = None
    type_demande: TypeDemande = TypeDemande.NOUVEL_APPAREILLAGE
    methode: MethodePEC = MethodePEC.EMAIL
    classe_lpp: Optional[int] = 1
    appareil_od_reference: Optional[str] = None
    appareil_og_reference: Optional[str] = None
    montant_demande_od: Optional[float] = None
    montant_demande_og: Optional[float] = None
    base_remboursement: Optional[float] = None
    email_destinataire: Optional[str] = None  # override email auto-détecté
    notes: Optional[str] = None


class PECSendEmailRequest(BaseModel):
    pec_id: UUID
    email_destinataire: Optional[str] = None  # override si besoin
    email_cc: Optional[str] = None
    documents: List[DocumentPECCreate] = []


class PECUpdate(BaseModel):
    statut: Optional[StatutPEC] = None
    reference_mutuelle: Optional[str] = None
    numero_dossier_mutuelle: Optional[str] = None
    montant_accorde_od: Optional[float] = None
    montant_accorde_og: Optional[float] = None
    date_validite: Optional[datetime] = None
    motif_refus: Optional[str] = None
    notes: Optional[str] = None


class PECRead(BaseModel):
    id: UUID
    patient_id: UUID
    author_id: UUID
    mutuelle_nom: str
    reseau_tiers_payant: Optional[str]
    numero_adherent: Optional[str]
    type_demande: TypeDemande
    methode: MethodePEC
    statut: StatutPEC
    classe_lpp: Optional[int]
    appareil_od_reference: Optional[str]
    appareil_og_reference: Optional[str]
    montant_demande_od: Optional[float]
    montant_demande_og: Optional[float]
    montant_accorde_od: Optional[float]
    montant_accorde_og: Optional[float]
    base_remboursement: Optional[float]
    reference_pec: Optional[str]
    reference_mutuelle: Optional[str]
    numero_dossier_mutuelle: Optional[str]
    email_destinataire: Optional[str]
    email_envoye_at: Optional[datetime]
    email_objet: Optional[str]
    date_demande: Optional[datetime]
    date_reponse: Optional[datetime]
    date_validite: Optional[datetime]
    motif_refus: Optional[str]
    notes: Optional[str]
    documents: List[DocumentPECRead] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class MutuelleInfo(BaseModel):
    nom: str
    reseau: str
    reseau_label: str
    email_pec: Optional[str]
    portail_url: Optional[str]
    portail_label: Optional[str]
    telephone: Optional[str]
    procedure_email: bool
    procedure_portail: bool
    documents_requis: List[str]
    delai_reponse_jours: int
    notes: Optional[str]
    couleur: str
