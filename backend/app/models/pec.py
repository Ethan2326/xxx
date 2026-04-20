from sqlalchemy import Column, String, Float, DateTime, Enum as SAEnum, ForeignKey, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class StatutPEC(str, enum.Enum):
    BROUILLON = "brouillon"
    EN_ATTENTE = "en_attente"
    ACCORDEE = "accordee"
    ACCORDEE_PARTIELLE = "accordee_partielle"
    REFUSEE = "refusee"
    ANNULEE = "annulee"
    EXPIRATION = "expiree"


class MethodePEC(str, enum.Enum):
    PORTAIL_WEB = "portail_web"
    EMAIL = "email"
    TELEPHONE = "telephone"
    COURRIER = "courrier"


class TypeDemande(str, enum.Enum):
    NOUVEL_APPAREILLAGE = "nouvel_appareillage"
    RENOUVELLEMENT = "renouvellement"
    SAV = "sav"
    ACCESSOIRES = "accessoires"


class PriseEnCharge(Base):
    __tablename__ = "prises_en_charge"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Mutuelle
    mutuelle_nom = Column(String, nullable=False)
    reseau_tiers_payant = Column(String)  # almerys, viamedis, santeclair, etc.
    numero_adherent = Column(String)
    organisme_code = Column(String)  # Code organisme SS

    # Demande
    type_demande = Column(SAEnum(TypeDemande), default=TypeDemande.NOUVEL_APPAREILLAGE)
    methode = Column(SAEnum(MethodePEC), default=MethodePEC.EMAIL)
    statut = Column(SAEnum(StatutPEC), default=StatutPEC.BROUILLON)

    # Appareils concernés
    appareil_od_reference = Column(String)
    appareil_og_reference = Column(String)
    classe_lpp = Column(Integer)          # 1 ou 2

    # Montants
    montant_demande_od = Column(Float)
    montant_demande_og = Column(Float)
    montant_accorde_od = Column(Float)
    montant_accorde_og = Column(Float)
    base_remboursement = Column(Float)

    # Références
    reference_pec = Column(String, unique=True)
    reference_mutuelle = Column(String)    # Référence donnée par la mutuelle
    numero_dossier_mutuelle = Column(String)

    # Email
    email_destinataire = Column(String)
    email_envoye_at = Column(DateTime)
    email_objet = Column(String)
    email_corps = Column(Text)

    # Dates
    date_demande = Column(DateTime)
    date_reponse = Column(DateTime)
    date_validite = Column(DateTime)       # Validité de la PEC accordée

    notes = Column(Text)
    motif_refus = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", backref="prises_en_charge")
    author = relationship("User")
    documents = relationship("DocumentPEC", back_populates="pec", cascade="all, delete-orphan")


class DocumentPEC(Base):
    """Documents joints à une PEC (devis, ordonnance, carte mutuelle, audiogramme…)"""
    __tablename__ = "documents_pec"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pec_id = Column(UUID(as_uuid=True), ForeignKey("prises_en_charge.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)

    type_document = Column(String, nullable=False)  # devis, ordonnance, carte_mutuelle, audiogramme, autre
    nom_fichier = Column(String, nullable=False)
    mime_type = Column(String, default="application/pdf")
    taille_octets = Column(Integer)
    chemin_fichier = Column(String)       # chemin sur le disque / clé S3
    contenu = Column(Text)                # base64 pour les petits fichiers

    created_at = Column(DateTime, default=datetime.utcnow)

    pec = relationship("PriseEnCharge", back_populates="documents")
