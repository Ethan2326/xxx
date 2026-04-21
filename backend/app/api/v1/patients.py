from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.patient import Patient
from app.models.audiogram import Audiogram
from app.models.device import HearingDevice, DeviceCatalog, CoteAppareillage, StatutAppareil
from app.schemas.patient import PatientCreate, PatientRead, PatientUpdate, PatientList
from app.schemas.audiogram import AudiogramRead
from app.schemas.device import HearingDeviceRead
from app.api.v1.auth import get_current_user
from app.models.user import User
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

router = APIRouter()


class DeviceQuickCreate(BaseModel):
    cote: CoteAppareillage
    marque: str
    modele: str
    reference: Optional[str] = None
    numero_serie: Optional[str] = None
    statut: StatutAppareil = StatutAppareil.ADAPTE


@router.get("", response_model=list[PatientList])
async def list_patients(
    search: Optional[str] = Query(None, description="Recherche nom, prénom, NIR"),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Patient).where(Patient.is_active == True)
    if search:
        term = f"%{search}%"
        q = q.where(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.nir.ilike(term),
            )
        )
    q = q.order_by(Patient.last_name, Patient.first_name).offset(skip).limit(limit)
    result = await db.execute(q)
    return [PatientList.model_validate(p) for p in result.scalars().all()]


@router.post("", response_model=PatientRead, status_code=201)
async def create_patient(
    patient_in: PatientCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    patient = Patient(**patient_in.model_dump())
    db.add(patient)
    await db.flush()
    await db.refresh(patient)
    return PatientRead.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientRead)
async def get_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    return PatientRead.model_validate(patient)


@router.patch("/{patient_id}", response_model=PatientRead)
async def update_patient(
    patient_id: UUID,
    patient_in: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    for field, value in patient_in.model_dump(exclude_none=True).items():
        setattr(patient, field, value)
    await db.flush()
    await db.refresh(patient)
    return PatientRead.model_validate(patient)


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    patient.is_active = False


@router.get("/{patient_id}/audiograms", response_model=list[AudiogramRead])
async def get_patient_audiograms(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Audiogram)
        .where(Audiogram.patient_id == patient_id)
        .order_by(Audiogram.date_mesure.desc())
    )
    audiograms = result.scalars().all()
    return [
        AudiogramRead(
            **{c.key: getattr(a, c.key) for c in a.__table__.columns},
            perte_moyenne_od=a.perte_moyenne_od,
            perte_moyenne_og=a.perte_moyenne_og,
            classification_od=a.classification_od,
            classification_og=a.classification_og,
        )
        for a in audiograms
    ]


@router.get("/{patient_id}/devices", response_model=list[HearingDeviceRead])
async def get_patient_devices(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(HearingDevice)
        .where(HearingDevice.patient_id == patient_id)
        .order_by(HearingDevice.created_at.desc())
    )
    return [HearingDeviceRead.model_validate(d) for d in result.scalars().all()]


@router.post("/{patient_id}/devices", response_model=HearingDeviceRead, status_code=201)
async def add_patient_device(
    patient_id: UUID,
    device_in: DeviceQuickCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Find or create catalog entry
    result = await db.execute(
        select(DeviceCatalog).where(
            DeviceCatalog.marque == device_in.marque,
            DeviceCatalog.modele == device_in.modele,
        )
    )
    catalog = result.scalar_one_or_none()
    if not catalog:
        catalog = DeviceCatalog(
            fabricant=device_in.marque,
            marque=device_in.marque,
            modele=device_in.modele,
            reference=device_in.reference or f"{device_in.marque}-{device_in.modele}",
        )
        db.add(catalog)
        await db.flush()

    device = HearingDevice(
        patient_id=patient_id,
        catalog_id=catalog.id,
        cote=device_in.cote,
        statut=device_in.statut,
        numero_serie=device_in.numero_serie or None,
    )
    db.add(device)
    await db.flush()
    await db.refresh(device)
    return HearingDeviceRead.model_validate(device)
