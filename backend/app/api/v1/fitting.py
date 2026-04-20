from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.fitting import FittingSession, FittingSituation
from app.models.patient import Patient
from app.models.audiogram import Audiogram
from app.schemas.fitting import (
    FittingSessionCreate, FittingSessionRead,
    FittingAIRequest, SituationRecommendation
)
from app.core.fitting_situations import FITTING_SITUATIONS, SITUATIONS_BY_KEY, SITUATIONS_BY_CATEGORY
from app.services.ai_service import get_fitting_recommendation
from app.api.v1.auth import get_current_user
from app.models.user import User
from uuid import UUID
from datetime import datetime

router = APIRouter()


@router.get("/situations")
async def list_situations(_: User = Depends(get_current_user)):
    """Retourne toutes les situations pré-enregistrées."""
    return {
        "categories": SITUATIONS_BY_CATEGORY,
        "total": len(FITTING_SITUATIONS),
    }


@router.get("/situations/{key}")
async def get_situation(key: str, _: User = Depends(get_current_user)):
    situation = SITUATIONS_BY_KEY.get(key)
    if not situation:
        raise HTTPException(status_code=404, detail="Situation non trouvée")
    return situation


@router.post("/sessions", response_model=FittingSessionRead, status_code=201)
async def create_fitting_session(
    session_in: FittingSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = FittingSession(
        patient_id=session_in.patient_id,
        user_id=current_user.id,
        noah_session_id=session_in.noah_session_id,
        parametres_avant=session_in.parametres_avant,
        notes=session_in.notes,
        date_session=datetime.utcnow(),
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return FittingSessionRead.model_validate(session)


@router.get("/sessions/{session_id}", response_model=FittingSessionRead)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(FittingSession).where(FittingSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    return FittingSessionRead.model_validate(session)


@router.post("/ai-recommendation")
async def ai_recommendation(
    req: FittingAIRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Obtient une recommandation IA pour une situation de réglage."""
    # Récupérer le contexte audiologique du patient
    patient_context = None

    patient_result = await db.execute(select(Patient).where(Patient.id == req.patient_id))
    patient = patient_result.scalar_one_or_none()

    if patient:
        audio_result = await db.execute(
            select(Audiogram)
            .where(Audiogram.patient_id == req.patient_id)
            .order_by(Audiogram.date_mesure.desc())
            .limit(1)
        )
        latest_audio = audio_result.scalar_one_or_none()
        if latest_audio:
            patient_context = {
                "perte_moyenne_od": latest_audio.perte_moyenne_od,
                "perte_moyenne_og": latest_audio.perte_moyenne_og,
                "classification_od": latest_audio.classification_od,
                "classification_og": latest_audio.classification_og,
                "type_appareillage": patient.type_appareillage.value if patient.type_appareillage else None,
            }

    recommendation = await get_fitting_recommendation(
        situation_key=req.situation_key,
        feedback_patient=req.feedback_patient or "Pas de retour spécifique",
        parametres_actuels=req.parametres_actuels,
        patient_context=patient_context,
    )

    # Sauvegarder dans la session
    situation_rec = FittingSituation(
        session_id=req.session_id,
        situation_key=req.situation_key,
        situation_label=SITUATIONS_BY_KEY.get(req.situation_key, {}).get("label"),
        parametres_appliques=req.parametres_actuels,
        feedback_patient=req.feedback_patient,
        recommandation_ia=recommendation,
    )
    db.add(situation_rec)

    return {
        "situation": SITUATIONS_BY_KEY.get(req.situation_key, {}),
        "recommendation": recommendation,
        "patient_context": patient_context,
    }


@router.get("/patient/{patient_id}/sessions", response_model=list[FittingSessionRead])
async def get_patient_sessions(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(FittingSession)
        .where(FittingSession.patient_id == patient_id)
        .order_by(FittingSession.date_session.desc())
    )
    return [FittingSessionRead.model_validate(s) for s in result.scalars().all()]
