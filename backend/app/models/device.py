from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SAEnum, JSON, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class CoteAppareillage(str, enum.Enum):
    DROIT = "droit"
    GAUCHE = "gauche"
    BILATERAL = "bilateral"


class StatutAppareil(str, enum.Enum):
    EN_ESSAI = "en_essai"
    COMMANDE = "commande"
    LIVRE = "livre"
    ADAPTE = "adapte"
    RETOURNE = "retourne"
    EN_SAV = "en_sav"


class DeviceCatalog(Base):
    """Catalogue des appareils auditifs des fabricants"""
    __tablename__ = "device_catalog"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fabricant = Column(String, nullable=False, index=True)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    reference = Column(String, nullable=False, index=True)
    ean = Column(String(13))

    type_appareil = Column(String)   # RITE, BTE, ITE, etc.
    niveau_technologie = Column(String)  # Essentiel, Confort, Premium, Ultra

    prix_achat_ht = Column(Float)
    prix_vente_conseille = Column(Float)
    classe_lpp = Column(Integer)     # Classe 1 ou 2 LPP

    caracteristiques = Column(JSON)  # Canaux, réducteur bruit, bluetooth, etc.
    edi_code = Column(String)        # Code pour commandes EDI
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HearingDevice(Base):
    """Appareils auditifs portés par un patient"""
    __tablename__ = "hearing_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    catalog_id = Column(UUID(as_uuid=True), ForeignKey("device_catalog.id"))

    cote = Column(SAEnum(CoteAppareillage), nullable=False)
    statut = Column(SAEnum(StatutAppareil), default=StatutAppareil.EN_ESSAI)
    numero_serie = Column(String, unique=True)

    # Informations LPP / facturation
    date_attribution = Column(DateTime)
    date_fin_garantie = Column(DateTime)
    prix_vente_ht = Column(Float)
    base_remboursement = Column(Float)
    remboursement_secu = Column(Float)
    remboursement_mutuelle = Column(Float)
    reste_a_charge = Column(Float)

    # Paramètres de réglage (stockés aussi dans Noah)
    programme_courant = Column(String)
    parametres_reglage = Column(JSON)
    notes_sav = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="devices")
    catalog = relationship("DeviceCatalog")
