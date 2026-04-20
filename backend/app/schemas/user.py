from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: UserRole = UserRole.AUDIOPROTHESISTE
    centre: Optional[str] = None
    rpps_number: Optional[str] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None
    centre: Optional[str] = None
    rpps_number: Optional[str] = None
    is_active: Optional[bool] = None


class UserRead(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: UserRole
    centre: Optional[str]
    rpps_number: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class TokenData(BaseModel):
    user_id: Optional[str] = None
