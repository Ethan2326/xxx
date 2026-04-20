from sqlalchemy import Column, String, Float, Date, DateTime, Enum as SAEnum, JSON, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class TypeAudiogramme(str, enum.Enum):
    TONAL = "tonal"
    VOCAL = "vocal"
    IMPEDANCEMETRIE = "impedancemetrie"
    OEA = "oea"
    PEA = "pea"


class Audiogram(Base):
    __tablename__ = "audiograms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    noah_session_id = Column(String)

    type = Column(SAEnum(TypeAudiogramme), default=TypeAudiogramme.TONAL, nullable=False)
    date_mesure = Column(Date, nullable=False)

    # Seuils tonals en dB HL par fréquence (250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz)
    # Format JSON: {"250": 20, "500": 25, "1000": 30, ...}
    seuils_od_ca = Column(JSON)   # Oreille droite, conduction aérienne
    seuils_od_co = Column(JSON)   # Oreille droite, conduction osseuse
    seuils_og_ca = Column(JSON)   # Oreille gauche, conduction aérienne
    seuils_og_co = Column(JSON)   # Oreille gauche, conduction osseuse

    # Audiométrie vocale
    vocal_od_intelligibilite = Column(Float)   # % à 65 dB
    vocal_og_intelligibilite = Column(Float)
    vocal_od_sds = Column(Float)               # Score de discrimination
    vocal_og_sds = Column(Float)

    # Tympanogramme
    tymp_od = Column(String)  # A, B, C, As, Ad
    tymp_og = Column(String)
    reflexes_od = Column(JSON)
    reflexes_og = Column(JSON)

    # Otoémissions acoustiques
    oea_od_present = Column(String)
    oea_og_present = Column(String)

    commentaire = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="audiograms")

    @property
    def perte_moyenne_od(self) -> float | None:
        """Fletcher index: moyenne à 500, 1000, 2000, 4000 Hz"""
        if not self.seuils_od_ca:
            return None
        freqs = ["500", "1000", "2000", "4000"]
        vals = [self.seuils_od_ca.get(f) for f in freqs if self.seuils_od_ca.get(f) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    @property
    def perte_moyenne_og(self) -> float | None:
        if not self.seuils_og_ca:
            return None
        freqs = ["500", "1000", "2000", "4000"]
        vals = [self.seuils_og_ca.get(f) for f in freqs if self.seuils_og_ca.get(f) is not None]
        return round(sum(vals) / len(vals), 1) if vals else None

    @property
    def classification_od(self) -> str:
        """Classification OMS de la perte auditive"""
        perte = self.perte_moyenne_od
        return self._classify(perte)

    @property
    def classification_og(self) -> str:
        perte = self.perte_moyenne_og
        return self._classify(perte)

    @staticmethod
    def _classify(perte: float | None) -> str:
        if perte is None:
            return "Non mesuré"
        if perte < 20:
            return "Audition normale"
        if perte < 40:
            return "Surdité légère"
        if perte < 55:
            return "Surdité moyenne"
        if perte < 70:
            return "Surdité moyenne à sévère"
        if perte < 90:
            return "Surdité sévère"
        return "Surdité profonde"
