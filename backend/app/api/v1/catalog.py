from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.device import DeviceCatalog
from app.schemas.device import DeviceCatalogRead
from app.api.v1.auth import get_current_user
from app.models.user import User
from typing import Optional

router = APIRouter()


@router.get("", response_model=list[DeviceCatalogRead])
async def search_catalog(
    q: Optional[str] = Query(None, description="Recherche modèle, référence, fabricant"),
    fabricant: Optional[str] = Query(None),
    type_appareil: Optional[str] = Query(None),
    classe_lpp: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(DeviceCatalog).where(DeviceCatalog.is_active == True)
    if q:
        term = f"%{q}%"
        query = query.where(
            or_(
                DeviceCatalog.modele.ilike(term),
                DeviceCatalog.reference.ilike(term),
                DeviceCatalog.fabricant.ilike(term),
                DeviceCatalog.marque.ilike(term),
            )
        )
    if fabricant:
        query = query.where(DeviceCatalog.fabricant == fabricant)
    if type_appareil:
        query = query.where(DeviceCatalog.type_appareil == type_appareil)
    if classe_lpp:
        query = query.where(DeviceCatalog.classe_lpp == classe_lpp)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return [DeviceCatalogRead.model_validate(d) for d in result.scalars().all()]
