from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.order import Order, OrderItem, StatutCommande
from app.schemas.order import OrderCreate, OrderRead, OrderUpdate
from app.services.edi_service import EDIMessage
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.config import get_settings
from datetime import datetime
from uuid import UUID

router = APIRouter()
settings = get_settings()


def _make_order_number(centre: str = "CTR") -> str:
    return f"{centre}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


@router.get("", response_model=list[OrderRead])
async def list_orders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Order).order_by(Order.created_at.desc()).limit(100)
    )
    return [OrderRead.model_validate(o) for o in result.scalars().all()]


@router.post("", response_model=OrderRead, status_code=201)
async def create_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    centre_code = (current_user.centre or "CTR")[:3].upper()
    numero = _make_order_number(centre_code)

    items_data = [i.model_dump() for i in order_in.items]
    montant_ht = sum(
        i.get("prix_unitaire_ht", 0) * i.get("quantite", 1)
        * (1 - i.get("remise_pct", 0) / 100)
        for i in items_data
    )
    tva = montant_ht * 0.055  # TVA appareils auditifs à 5,5%

    order = Order(
        numero_commande=numero,
        patient_id=order_in.patient_id,
        type=order_in.type,
        fabricant=order_in.fabricant,
        date_livraison_souhaitee=order_in.date_livraison_souhaitee,
        adresse_livraison=order_in.adresse_livraison,
        notes=order_in.notes,
        montant_ht=round(montant_ht, 2),
        montant_tva=round(tva, 2),
        montant_ttc=round(montant_ht + tva, 2),
    )
    db.add(order)
    await db.flush()

    for item_data in items_data:
        montant_item = (
            item_data.get("prix_unitaire_ht", 0)
            * item_data.get("quantite", 1)
            * (1 - item_data.get("remise_pct", 0) / 100)
        )
        item = OrderItem(
            order_id=order.id,
            montant_ht=round(montant_item, 2),
            **{k: v for k, v in item_data.items() if k != "catalog_id"},
            catalog_id=item_data.get("catalog_id"),
        )
        db.add(item)

    await db.flush()
    await db.refresh(order)
    return OrderRead.model_validate(order)


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    return OrderRead.model_validate(order)


@router.patch("/{order_id}", response_model=OrderRead)
async def update_order(
    order_id: UUID,
    order_in: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    for field, value in order_in.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    await db.flush()
    await db.refresh(order)
    return OrderRead.model_validate(order)


@router.post("/{order_id}/send-edi", response_model=OrderRead)
async def send_order_edi(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Génère et envoie le message EDIFACT ORDERS au fabricant."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    if order.statut != StatutCommande.BROUILLON:
        raise HTTPException(status_code=400, detail="Commande déjà envoyée")

    # Charger les items
    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    items = items_result.scalars().all()

    edi_svc = EDIMessage(
        sender_id=settings.EDI_SENDER_ID or "AUDIOASSIST",
        receiver_id=settings.EDI_RECEIVER_ID or order.fabricant.upper()[:10],
    )

    order_dict = {
        "numero_commande": order.numero_commande,
        "fabricant": order.fabricant,
        "adresse_livraison": order.adresse_livraison or "",
        "date_livraison_souhaitee": order.date_livraison_souhaitee,
        "items": [
            {
                "reference": i.reference,
                "designation": i.designation,
                "quantite": i.quantite,
                "prix_unitaire_ht": i.prix_unitaire_ht or 0,
                "numero_serie": i.numero_serie,
                "motif_sav": i.motif_sav,
            }
            for i in items
        ],
    }

    edi_message = edi_svc.build_order(order_dict)

    # TODO: envoyer via SFTP/AS2 — pour l'instant on stocke le message
    order.edi_message_id = edi_svc.interchange_ref
    order.edi_sent_at = datetime.utcnow()
    order.statut = StatutCommande.ENVOYEE
    order.metadata_edi = {"raw_message": edi_message[:2000]}

    await db.flush()
    await db.refresh(order)
    return OrderRead.model_validate(order)


@router.get("/{order_id}/edi-preview")
async def preview_edi(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Prévisualise le message EDIFACT sans l'envoyer."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")

    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))
    items = items_result.scalars().all()

    edi_svc = EDIMessage(sender_id="AUDIOASSIST", receiver_id=order.fabricant.upper()[:10])
    order_dict = {
        "numero_commande": order.numero_commande,
        "fabricant": order.fabricant,
        "adresse_livraison": order.adresse_livraison or "",
        "date_livraison_souhaitee": order.date_livraison_souhaitee,
        "items": [
            {
                "reference": i.reference,
                "designation": i.designation,
                "quantite": i.quantite,
                "prix_unitaire_ht": i.prix_unitaire_ht or 0,
            }
            for i in items
        ],
    }
    return {"edi_message": edi_svc.build_order(order_dict)}
