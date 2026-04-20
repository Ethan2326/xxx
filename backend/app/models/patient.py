from sqlalchemy import Column, String, Date, Enum as SAEnum, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class LateraliteAuditive(str, enum.Enum):
    BILATERAL = "bilateral"
    DROIT = "droit"
    GAUCHE = "gauche"


class TypeAppareillage(str, enum.Enum):
    RITE = "RITE"
    BTE = "BTE"
    ITE = "ITE"
    ITC = "ITC"
    CIC = "CIC"
    IIC = "IIC"
    CROS = "CROS"
    BICROS = "BiCROS"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    noah_id = Column(String, unique=True, index=True)
    cosium_id = Column(String, unique=True, index=True)
    audiowizard_id = Column(String, unique=True, index=True)

    # Identité
    nir = Column(String(15))  # Numéro de sécurité sociale
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    birth_date = Column(Date, nullable=False)
    gender = Column(String(1))  # M / F
    email = Column(String)
    phone = Column(String)
    mobile = Column(String)
    address = Column(Text)
    city = Column(String)
    postal_code = Column(String(5))

    # Contexte audiologique
    lateralite = Column(SAEnum(LateraliteAuditive))
    type_appareillage = Column(SAEnum(TypeAppareillage))
    prescripteur = Column(String)
    mutuelle = Column(String)
    numero_adherent_mutuelle = Column(String)
    notes = Column(Text)

    # Métadonnées
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    audiograms = relationship("Audiogram", back_populates="patient", cascade="all, delete-orphan")
    devices = relationship("HearingDevice", back_populates="patient")
    orders = relationship("Order", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")
    reports = relationship("Report", back_populates="patient")
    fitting_sessions = relationship("FittingSession", back_populates="patient")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self) -> int:
        from datetime import date
        today = date.today()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )
