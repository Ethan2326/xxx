from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.database import get_db
from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentCreate, AppointmentRead, AppointmentUpdate
from app.api.v1.auth import get_current_user
from app.models.user import User
from datetime import date, datetime
from typing import Optional
from uuid import UUID

router = APIRouter()


@router.get("", response_model=list[AppointmentRead])
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
    return [AppointmentRead.model_validate(a) for a in result.scalars().all()]


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
