from sqlalchemy import Column, String, DateTime, Enum as SAEnum, ForeignKey, Text, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class TypeRdv(str, enum.Enum):
    PREMIER_APPAREILLAGE = "premier_appareillage"
    ESSAI = "essai"
    ADAPTATION = "adaptation"
    SUIVI = "suivi"
    CONTROLE = "controle"
    SAV = "sav"
    BILAN = "bilan"
    RENOUVELLEMENT = "renouvellement"


class StatutRdv(str, enum.Enum):
    PLANIFIE = "planifie"
    CONFIRME = "confirme"
    ARRIVE = "arrive"
    EN_COURS = "en_cours"
    TERMINE = "termine"
    ANNULE = "annule"
    ABSENT = "absent"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    type = Column(SAEnum(TypeRdv), nullable=False)
    statut = Column(SAEnum(StatutRdv), default=StatutRdv.PLANIFIE)

    debut = Column(DateTime, nullable=False)
    fin = Column(DateTime, nullable=False)
    duree_minutes = Column(Integer, default=30)

    salle = Column(String)
    notes = Column(Text)
    rappel_envoye = Column(Boolean, default=False)

    cosium_rdv_id = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="appointments")
    user = relationship("User", back_populates="appointments")
