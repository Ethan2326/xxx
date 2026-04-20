from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import date, datetime
from app.models.patient import LateraliteAuditive, TypeAppareillage


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    birth_date: date
    gender: Optional[str] = None
    nir: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    lateralite: Optional[LateraliteAuditive] = None
    type_appareillage: Optional[TypeAppareillage] = None
    prescripteur: Optional[str] = None
    mutuelle: Optional[str] = None
    numero_adherent_mutuelle: Optional[str] = None
    notes: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    nir: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    lateralite: Optional[LateraliteAuditive] = None
    type_appareillage: Optional[TypeAppareillage] = None
    prescripteur: Optional[str] = None
    mutuelle: Optional[str] = None
    numero_adherent_mutuelle: Optional[str] = None
    notes: Optional[str] = None


class PatientRead(BaseModel):
    id: UUID
    noah_id: Optional[str]
    cosium_id: Optional[str]
    first_name: str
    last_name: str
    birth_date: date
    gender: Optional[str]
    nir: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    mobile: Optional[str]
    address: Optional[str]
    city: Optional[str]
    postal_code: Optional[str]
    lateralite: Optional[LateraliteAuditive]
    type_appareillage: Optional[TypeAppareillage]
    prescripteur: Optional[str]
    mutuelle: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientList(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    birth_date: date
    phone: Optional[str]
    mobile: Optional[str]
    lateralite: Optional[LateraliteAuditive]
    type_appareillage: Optional[TypeAppareillage]

    model_config = {"from_attributes": True}
