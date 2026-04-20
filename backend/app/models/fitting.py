from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Float, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.database import Base


class FittingSession(Base):
    """Session de réglage d'appareils auditifs"""
    __tablename__ = "fitting_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    noah_session_id = Column(String)
    date_session = Column(DateTime, default=datetime.utcnow)

    # État avant/après réglage
    parametres_avant = Column(JSON)
    parametres_apres = Column(JSON)

    # IA utilisée pendant la session
    situations_testees = Column(JSON)  # Liste des situations testées
    recommandations_ia = Column(Text)
    satisfaction_patient = Column(Float)  # 0-10

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="fitting_sessions")
    user = relationship("User", back_populates="fitting_sessions")
    situations = relationship("FittingSituation", back_populates="session", cascade="all, delete-orphan")


class FittingSituation(Base):
    """Situation de réglage testée pendant une session"""
    __tablename__ = "fitting_situations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("fitting_sessions.id"), nullable=False)

    situation_key = Column(String, nullable=False)  # ex: "restaurant", "tv", "telephone"
    situation_label = Column(String)
    parametres_appliques = Column(JSON)
    feedback_patient = Column(Text)
    score_satisfaction = Column(Float)  # 0-5
    recommandation_ia = Column(Text)
    appliquee = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("FittingSession", back_populates="situations")
