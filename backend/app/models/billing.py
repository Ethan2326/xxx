from sqlalchemy import Column, String, Date, DateTime, Numeric, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.database import Base


LPP_FORFAITS = {
    1: {"od": 200.00, "og": 200.00, "bilateral": 400.00},    # Classe 1
    2: {"od": 1700.00, "og": 1700.00, "bilateral": 3400.00}, # Classe 2
}
TAUX_TVA = 0.055  # 5.5% pour appareils auditifs


class Devis(Base):
    __tablename__ = "devis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    numero = Column(String, unique=True, nullable=False)  # DEV-2024-001
    statut = Column(String, default="brouillon")  # brouillon, envoye, accepte, refuse, expire

    date_devis = Column(Date, nullable=False)
    date_validite = Column(Date)  # 30 days default

    # Appareil OD
    appareil_od_marque = Column(String)
    appareil_od_modele = Column(String)
    appareil_od_reference = Column(String)
    appareil_od_classe_lpp = Column(Integer)  # 1 or 2
    appareil_od_prix_ht = Column(Numeric(10, 2))

    # Appareil OG
    appareil_og_marque = Column(String)
    appareil_og_modele = Column(String)
    appareil_og_reference = Column(String)
    appareil_og_classe_lpp = Column(Integer)
    appareil_og_prix_ht = Column(Numeric(10, 2))

    # Financier
    base_remboursement_secu = Column(Numeric(10, 2))  # LPP forfait
    remboursement_secu = Column(Numeric(10, 2))
    remboursement_mutuelle = Column(Numeric(10, 2))
    reste_a_charge = Column(Numeric(10, 2))

    # Accessoires/Services JSON: [{designation, quantite, prix_ht, tva}]
    lignes_json = Column(Text)

    montant_total_ht = Column(Numeric(10, 2))
    montant_tva = Column(Numeric(10, 2))
    montant_ttc = Column(Numeric(10, 2))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")


class Facture(Base):
    __tablename__ = "factures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    devis_id = Column(UUID(as_uuid=True), ForeignKey("devis.id"), nullable=True)
    numero = Column(String, unique=True, nullable=False)  # FAC-2024-001
    statut = Column(String, default="emise")  # emise, payee, partiellement_payee, annulee

    date_facture = Column(Date, nullable=False)

    montant_ttc = Column(Numeric(10, 2))
    montant_paye = Column(Numeric(10, 2), default=0)
    reste_a_payer = Column(Numeric(10, 2))

    lignes_json = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    devis = relationship("Devis")
