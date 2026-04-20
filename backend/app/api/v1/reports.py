from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.report import Report
from app.models.patient import Patient
from app.models.audiogram import Audiogram
from app.models.device import HearingDevice
from app.schemas.report import ReportCreate, ReportRead, ReportUpdate, ReportGenerateRequest
from app.services.ai_service import generate_report
from app.api.v1.auth import get_current_user
from app.models.user import User
from uuid import UUID
import json

router = APIRouter()


@router.get("", response_model=list[ReportRead])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).order_by(Report.created_at.desc()).limit(50))
    return [ReportRead.model_validate(r) for r in result.scalars().all()]


@router.post("/generate", response_model=ReportRead, status_code=201)
async def generate_ai_report(
    req: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Génère un compte rendu via l'IA et le sauvegarde."""
    # Charger le patient
    patient_result = await db.execute(select(Patient).where(Patient.id == req.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    # Charger le dernier audiogramme ou celui spécifié
    audiogram = None
    if req.audiogram_id:
        audio_result = await db.execute(select(Audiogram).where(Audiogram.id == req.audiogram_id))
        audiogram = audio_result.scalar_one_or_none()
    else:
        audio_result = await db.execute(
            select(Audiogram)
            .where(Audiogram.patient_id == req.patient_id)
            .order_by(Audiogram.date_mesure.desc())
            .limit(1)
        )
        audiogram = audio_result.scalar_one_or_none()

    # Charger les appareils
    devices_result = await db.execute(
        select(HearingDevice).where(HearingDevice.patient_id == req.patient_id)
    )
    devices = devices_result.scalars().all()

    # Préparer les dicts pour le service IA
    patient_dict = {
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "birth_date": str(patient.birth_date),
        "age": patient.age,
        "gender": patient.gender,
        "lateralite": patient.lateralite.value if patient.lateralite else None,
        "mutuelle": patient.mutuelle,
    }

    audiogram_dict = None
    if audiogram:
        audiogram_dict = {
            "date_mesure": str(audiogram.date_mesure),
            "perte_moyenne_od": audiogram.perte_moyenne_od,
            "perte_moyenne_og": audiogram.perte_moyenne_og,
            "classification_od": audiogram.classification_od,
            "classification_og": audiogram.classification_og,
            "seuils_od_ca": audiogram.seuils_od_ca,
            "seuils_og_ca": audiogram.seuils_og_ca,
            "vocal_od_intelligibilite": audiogram.vocal_od_intelligibilite,
            "vocal_og_intelligibilite": audiogram.vocal_og_intelligibilite,
        }

    devices_list = []
    for d in devices:
        device_dict = {
            "cote": d.cote.value,
            "statut": d.statut.value,
            "numero_serie": d.numero_serie,
        }
        if d.catalog:
            device_dict["catalog"] = {
                "marque": d.catalog.marque,
                "modele": d.catalog.modele,
                "reference": d.catalog.reference,
            }
        devices_list.append(device_dict)

    auteur_dict = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "rpps_number": current_user.rpps_number,
        "centre": current_user.centre,
    }

    prescripteur_dict = None
    if req.prescripteur_nom:
        prescripteur_dict = {
            "nom": req.prescripteur_nom,
            "specialite": req.prescripteur_specialite or "Médecin",
        }

    # Appel IA
    result = await generate_report(
        patient=patient_dict,
        audiogram=audiogram_dict,
        devices=devices_list,
        type_rapport=req.type.value,
        prescripteur=prescripteur_dict,
        auteur=auteur_dict,
        contexte_supplementaire=req.contexte_supplementaire,
    )

    # Créer l'entrée en base
    report = Report(
        patient_id=req.patient_id,
        author_id=current_user.id,
        audiogram_id=audiogram.id if audiogram else None,
        type=req.type,
        titre=result["titre"],
        prescripteur_nom=req.prescripteur_nom,
        prescripteur_specialite=req.prescripteur_specialite,
        contenu_json=result["contenu_json"],
        contenu_html=result["contenu_html"],
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return ReportRead.model_validate(report)


@router.get("/{report_id}", response_model=ReportRead)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")
    return ReportRead.model_validate(report)


@router.get("/{report_id}/html", response_class=HTMLResponse)
async def get_report_html(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")
    return HTMLResponse(content=report.contenu_html or "<p>Aucun contenu</p>")


@router.patch("/{report_id}", response_model=ReportRead)
async def update_report(
    report_id: UUID,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")
    for field, value in report_in.model_dump(exclude_none=True).items():
        setattr(report, field, value)
    await db.flush()
    await db.refresh(report)
    return ReportRead.model_validate(report)


@router.get("/patient/{patient_id}", response_model=list[ReportRead])
async def get_patient_reports(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Report)
        .where(Report.patient_id == patient_id)
        .order_by(Report.created_at.desc())
    )
    return [ReportRead.model_validate(r) for r in result.scalars().all()]
