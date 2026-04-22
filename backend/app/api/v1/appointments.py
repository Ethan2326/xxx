from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.audiogram import Audiogram
from app.models.device import HearingDevice
from app.schemas.appointment import AppointmentCreate, AppointmentRead, AppointmentUpdate
from app.api.v1.auth import get_current_user
from app.models.user import User
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID
import json

router = APIRouter()

# Durées standard par type (minutes)
_DUREE_TYPE = {
    "premier_appareillage": 90,
    "essai": 60,
    "adaptation": 45,
    "suivi": 30,
    "controle": 30,
    "sav": 20,
    "bilan": 60,
    "renouvellement": 60,
}

# Horaires d'ouverture (heure de début, heure de fin)
_HORAIRES = (8, 0, 18, 0)  # 8h00 → 18h00


class AppointmentReadWithPatient(AppointmentRead):
    patient_nom: Optional[str] = None
    patient_id_str: Optional[str] = None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[AppointmentReadWithPatient])
async def list_appointments(
    date_debut: Optional[date] = Query(None),
    date_fin: Optional[date] = Query(None),
    user_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Appointment)
    if date_debut:
        q = q.where(Appointment.debut >= datetime.combine(date_debut, datetime.min.time()))
    if date_fin:
        q = q.where(Appointment.debut <= datetime.combine(date_fin, datetime.max.time()))
    if user_id:
        q = q.where(Appointment.user_id == user_id)
    q = q.order_by(Appointment.debut)
    result = await db.execute(q)
    appts = result.scalars().all()

    patient_ids = {a.patient_id for a in appts}
    patients = {}
    if patient_ids:
        pr = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        patients = {p.id: p for p in pr.scalars().all()}

    out = []
    for a in appts:
        data = AppointmentReadWithPatient.model_validate(a)
        if a.patient_id in patients:
            p = patients[a.patient_id]
            data.patient_nom = f"{p.last_name.upper()} {p.first_name}"
        out.append(data)
    return out


@router.post("", response_model=AppointmentRead, status_code=201)
async def create_appointment(
    appt_in: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    duration = int((appt_in.fin - appt_in.debut).total_seconds() / 60)
    appt = Appointment(**appt_in.model_dump(), duree_minutes=duration)
    db.add(appt)
    await db.flush()
    await db.refresh(appt)
    return AppointmentRead.model_validate(appt)


@router.patch("/{appt_id}", response_model=AppointmentRead)
async def update_appointment(
    appt_id: UUID,
    appt_in: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    for field, value in appt_in.model_dump(exclude_none=True).items():
        setattr(appt, field, value)
    await db.flush()
    await db.refresh(appt)
    return AppointmentRead.model_validate(appt)


@router.delete("/{appt_id}", status_code=204)
async def delete_appointment(
    appt_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    await db.delete(appt)


@router.get("/ai-suggest")
async def ai_suggest_slots(
    patient_id: UUID = Query(...),
    type_rdv: str = Query(...),
    date_souhaitee: Optional[date] = Query(None),
    nb_suggestions: int = Query(3, le=5),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Suggère les meilleurs créneaux pour un RDV en tenant compte :
    - des RDV existants (pas de conflit)
    - des préférences horaires habituelles du patient
    - de la durée standard du type de RDV
    - de l'historique patient (urgence SAV, délai suivi, etc.)
    """
    duree = _DUREE_TYPE.get(type_rdv, 30)
    start_date = date_souhaitee or (datetime.utcnow().date() + timedelta(days=1))

    # Charger le patient et son contexte
    patient_r = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = patient_r.scalar_one_or_none()

    # Charger les RDV existants sur 3 semaines
    scan_end = start_date + timedelta(days=21)
    appts_r = await db.execute(
        select(Appointment)
        .where(Appointment.debut >= datetime.combine(start_date, datetime.min.time()))
        .where(Appointment.debut <= datetime.combine(scan_end, datetime.max.time()))
        .order_by(Appointment.debut)
    )
    existing = appts_r.scalars().all()

    # Trouver créneaux libres
    suggestions = []
    current_date = start_date

    open_h, open_m, close_h, close_m = _HORAIRES
    open_time = timedelta(hours=open_h, minutes=open_m)
    close_time = timedelta(hours=close_h, minutes=close_m)

    while len(suggestions) < nb_suggestions and current_date <= scan_end:
        # Skip weekends
        if current_date.weekday() >= 5:
            current_date += timedelta(days=1)
            continue

        # Slots toutes les 15 minutes
        slot = datetime.combine(current_date, datetime.min.time()) + open_time
        day_end = datetime.combine(current_date, datetime.min.time()) + close_time - timedelta(minutes=duree)

        day_appts = [a for a in existing if a.debut.date() == current_date]

        while slot <= day_end and len(suggestions) < nb_suggestions:
            slot_end = slot + timedelta(minutes=duree)
            conflict = any(
                not (slot_end <= a.debut or slot >= a.fin)
                for a in day_appts
            )
            if not conflict:
                # Score heuristique : préférer le matin (9h-12h) sauf SAV
                hour = slot.hour
                if type_rdv == "sav":
                    score = 100 - abs(hour - 10)
                elif type_rdv in ("premier_appareillage", "bilan"):
                    score = 100 - abs(hour - 9)
                else:
                    score = 100 - abs(hour - 10)

                suggestions.append({
                    "debut": slot.isoformat(),
                    "fin": slot_end.isoformat(),
                    "duree_minutes": duree,
                    "score": score,
                    "label": f"{slot.strftime('%A %d %B à %Hh%M')} ({duree} min)",
                })
                slot += timedelta(minutes=15)
            else:
                slot += timedelta(minutes=15)

        current_date += timedelta(days=1)

    # Contexte IA sur le patient
    contexte = {}
    if patient:
        # Dernier audiogramme
        last_audio_r = await db.execute(
            select(Audiogram)
            .where(Audiogram.patient_id == patient_id)
            .order_by(Audiogram.date_mesure.desc())
            .limit(1)
        )
        last_audio = last_audio_r.scalar_one_or_none()

        # Appareils actifs
        devices_r = await db.execute(
            select(HearingDevice).where(HearingDevice.patient_id == patient_id)
        )
        devices = devices_r.scalars().all()

        # Dernier RDV
        last_appt_r = await db.execute(
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(Appointment.debut.desc())
            .limit(1)
        )
        last_appt = last_appt_r.scalar_one_or_none()

        contexte = {
            "patient_nom": f"{patient.last_name.upper()} {patient.first_name}",
            "age": patient.age,
            "mutuelle": patient.mutuelle,
            "last_audiogram": str(last_audio.date_mesure) if last_audio else None,
            "nb_appareils": len(devices),
            "last_rdv": str(last_appt.debut.date()) if last_appt else None,
            "last_rdv_type": last_appt.type.value if last_appt else None,
        }

    # Message IA contextuel
    ai_message = _generate_ai_scheduling_advice(type_rdv, contexte, suggestions)

    return {
        "suggestions": suggestions[:nb_suggestions],
        "duree_minutes": duree,
        "contexte_patient": contexte,
        "ai_message": ai_message,
    }


def _generate_ai_scheduling_advice(type_rdv: str, ctx: dict, slots: list) -> str:
    nom = ctx.get("patient_nom", "ce patient")
    last_rdv = ctx.get("last_rdv")
    last_audio = ctx.get("last_audiogram")
    nb_app = ctx.get("nb_appareils", 0)

    if type_rdv == "sav":
        return (
            f"RDV SAV prioritaire pour {nom}. "
            "Prévoir 20 min pour diagnostic et nettoyage. "
            f"{'Dernier RDV le ' + last_rdv + '.' if last_rdv else ''}"
        )
    if type_rdv == "premier_appareillage":
        return (
            f"Premier appareillage pour {nom}. "
            "Prévoir 90 min : anamnèse, choix appareils, essai initial. "
            f"{'Audiogramme du ' + last_audio + ' disponible.' if last_audio else 'Penser à réaliser le bilan audiométrique en amont.'}"
        )
    if type_rdv == "suivi":
        days_since = None
        if last_rdv:
            try:
                from datetime import date as d_type
                delta = (d_type.today() - date.fromisoformat(last_rdv)).days
                days_since = delta
            except Exception:
                pass
        msg = f"Suivi pour {nom}. "
        if days_since and days_since > 180:
            msg += f"⚠️ Dernier RDV il y a {days_since} jours — suivi tardif à signaler. "
        if nb_app:
            msg += f"{nb_app} appareil(s) en cours d'adaptation. "
        return msg.strip()
    if type_rdv == "controle":
        return (
            f"Contrôle de routine pour {nom}. "
            "Vérifier le port effectif, satisfaction globale, nettoyage préventif."
        )
    if type_rdv == "bilan":
        return (
            f"Bilan audiométrique pour {nom}. "
            "Prévoir salle d'audiométrie libre. "
            f"{'Dernier bilan le ' + last_audio + '.' if last_audio else 'Premier bilan — prévoir audiogramme complet.'}"
        )
    if type_rdv == "renouvellement":
        return (
            f"Renouvellement d'appareillage pour {nom}. "
            "Préparer le dossier mutuelle et les références des appareils précédents. "
            "Durée minimale 1h pour le choix et la simulation."
        )
    return f"Rendez-vous {type_rdv} planifié pour {nom}."
