from sqlalchemy import Column, String, Float, DateTime, Enum as SAEnum, JSON, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from app.database import Base


class StatutCommande(str, enum.Enum):
    BROUILLON = "brouillon"
    ENVOYEE = "envoyee"
    CONFIRMEE = "confirmee"
    EN_PREPARATION = "en_preparation"
    EXPEDIEE = "expediee"
    LIVREE = "livree"
    ANNULEE = "annulee"
    RETOUR = "retour"


class TypeCommande(str, enum.Enum):
    NEUF = "neuf"
    SAV = "sav"
    RETOUR = "retour"
    CONSOMMABLE = "consommable"  # Piles, domes, tubes, etc.


class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_commande = Column(String, unique=True, index=True)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"))

    type = Column(SAEnum(TypeCommande), nullable=False, default=TypeCommande.NEUF)
    statut = Column(SAEnum(StatutCommande), default=StatutCommande.BROUILLON)
    fabricant = Column(String, nullable=False)

    # EDI
    edi_message_id = Column(String)
    edi_sent_at = Column(DateTime)
    edi_confirmed_at = Column(DateTime)
    edi_reference_fournisseur = Column(String)

    date_livraison_souhaitee = Column(DateTime)
    date_livraison_reelle = Column(DateTime)
    adresse_livraison = Column(Text)

    montant_ht = Column(Float, default=0.0)
    montant_tva = Column(Float, default=0.0)
    montant_ttc = Column(Float, default=0.0)

    notes = Column(Text)
    metadata_edi = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    patient = relationship("Patient", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False)
    catalog_id = Column(UUID(as_uuid=True), ForeignKey("device_catalog.id"))

    reference = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    quantite = Column(Integer, default=1)
    prix_unitaire_ht = Column(Float)
    remise_pct = Column(Float, default=0.0)
    montant_ht = Column(Float)

    # SAV
    motif_sav = Column(String)
    numero_serie = Column(String)

    order = relationship("Order", back_populates="items")
    catalog = relationship("DeviceCatalog")
