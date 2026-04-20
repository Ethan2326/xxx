from sqlalchemy import Column, String, DateTime, Enum as SAEnum, ForeignKey, Text, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class TypeCompteRendu(str, enum.Enum):
    BILAN_INITIAL = "bilan_initial"
    APPAREILLAGE = "appareillage"
    CONTROLE_3MOIS = "controle_3mois"
    CONTROLE_ANNUEL = "controle_annuel"
    FIN_ESSAI = "fin_essai"
    SAV = "sav"
    RENOUVELLEMENT = "renouvellement"
    LIBRE = "libre"


class StatutCompteRendu(str, enum.Enum):
    BROUILLON = "brouillon"
    FINALISE = "finalise"
    ENVOYE = "envoye"


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    audiogram_id = Column(UUID(as_uuid=True), ForeignKey("audiograms.id"))

    type = Column(SAEnum(TypeCompteRendu), nullable=False)
    statut = Column(SAEnum(StatutCompteRendu), default=StatutCompteRendu.BROUILLON)
    titre = Column(String, nullable=False)

    # Destinataires
    prescripteur_nom = Column(String)
    prescripteur_rpps = Column(String)
    prescripteur_specialite = Column(String)

    # Contenu structuré
    contenu_json = Column(Text)   # JSON avec les sections du CR
    contenu_html = Column(Text)   # Version HTML rendue
    pdf_data = Column(LargeBinary)

    date_redaction = Column(DateTime, default=datetime.utcnow)
    date_envoi = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="reports")
    author = relationship("User", back_populates="reports")
    audiogram = relationship("Audiogram")
