from sqlalchemy import Column, String, Boolean, Enum as SAEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    AUDIOPROTHESISTE = "audioprothesiste"
    SECRETAIRE = "secretaire"
    STAGIAIRE = "stagiaire"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.AUDIOPROTHESISTE, nullable=False)
    centre = Column(String)
    rpps_number = Column(String, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)

    appointments = relationship("Appointment", back_populates="user")
    reports = relationship("Report", back_populates="author")
    fitting_sessions = relationship("FittingSession", back_populates="user")
