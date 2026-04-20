from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.audiogram import Audiogram
from app.schemas.audiogram import AudiogramCreate, AudiogramRead
from app.api.v1.auth import get_current_user
from app.models.user import User
from uuid import UUID

router = APIRouter()


@router.post("", response_model=AudiogramRead, status_code=201)
async def create_audiogram(
    audio_in: AudiogramCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    audiogram = Audiogram(**audio_in.model_dump())
    db.add(audiogram)
    await db.flush()
    await db.refresh(audiogram)
    return AudiogramRead(
        **{c.key: getattr(audiogram, c.key) for c in audiogram.__table__.columns},
        perte_moyenne_od=audiogram.perte_moyenne_od,
        perte_moyenne_og=audiogram.perte_moyenne_og,
        classification_od=audiogram.classification_od,
        classification_og=audiogram.classification_og,
    )


@router.get("/{audiogram_id}", response_model=AudiogramRead)
async def get_audiogram(
    audiogram_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Audiogram).where(Audiogram.id == audiogram_id))
    audiogram = result.scalar_one_or_none()
    if not audiogram:
        raise HTTPException(status_code=404, detail="Audiogramme non trouvé")
    return AudiogramRead(
        **{c.key: getattr(audiogram, c.key) for c in audiogram.__table__.columns},
        perte_moyenne_od=audiogram.perte_moyenne_od,
        perte_moyenne_og=audiogram.perte_moyenne_og,
        classification_od=audiogram.classification_od,
        classification_og=audiogram.classification_og,
    )


@router.delete("/{audiogram_id}", status_code=204)
async def delete_audiogram(
    audiogram_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Audiogram).where(Audiogram.id == audiogram_id))
    audiogram = result.scalar_one_or_none()
    if not audiogram:
        raise HTTPException(status_code=404, detail="Audiogramme non trouvé")
    await db.delete(audiogram)
