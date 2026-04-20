"""
Service d'intégration Noah 4 (HIMSA).
Noah 4 expose une API COM/SOAP locale sur le poste de travail de l'audioprothésiste.
Ce service communique via HTTP avec un agent Noah local (noah-bridge).
"""

import httpx
from typing import Optional
from uuid import UUID
from datetime import date
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()

NOAH_BRIDGE_URL = f"http://{settings.NOAH4_HOST}:{settings.NOAH4_PORT}"


class Noah4Service:
    def __init__(self):
        self.base_url = NOAH_BRIDGE_URL
        self.timeout = settings.NOAH4_TIMEOUT

    async def ping(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self.base_url}/health")
                return r.status_code == 200
        except Exception:
            return False

    # ── Patients ──────────────────────────────────────────────────────────────

    async def get_patients(self) -> list[dict]:
        """Récupère tous les patients Noah."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/patients")
            r.raise_for_status()
            return r.json()

    async def get_patient(self, noah_id: str) -> Optional[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/patients/{noah_id}")
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()

    async def create_patient(self, patient_data: dict) -> dict:
        """Crée un patient dans Noah 4."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(f"{self.base_url}/patients", json=patient_data)
            r.raise_for_status()
            return r.json()

    async def update_patient(self, noah_id: str, patient_data: dict) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.put(f"{self.base_url}/patients/{noah_id}", json=patient_data)
            r.raise_for_status()
            return r.json()

    # ── Sessions de mesures ───────────────────────────────────────────────────

    async def get_sessions(self, noah_id: str) -> list[dict]:
        """Récupère les sessions de mesures Noah d'un patient."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/patients/{noah_id}/sessions")
            r.raise_for_status()
            return r.json()

    async def get_latest_audiogram(self, noah_id: str) -> Optional[dict]:
        """Récupère le dernier audiogramme tonal du patient."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/patients/{noah_id}/audiogram/latest")
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()

    async def save_fitting_session(self, noah_id: str, session_data: dict) -> dict:
        """Enregistre une session de réglage dans Noah 4."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                f"{self.base_url}/patients/{noah_id}/fitting-sessions",
                json=session_data
            )
            r.raise_for_status()
            return r.json()

    # ── Appareils ─────────────────────────────────────────────────────────────

    async def get_devices(self, noah_id: str) -> list[dict]:
        """Récupère les appareils auditifs du patient dans Noah."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(f"{self.base_url}/patients/{noah_id}/devices")
            r.raise_for_status()
            return r.json()

    async def open_fitting_software(self, noah_id: str, device_id: str) -> bool:
        """Lance le logiciel de réglage du fabricant via Noah."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                f"{self.base_url}/patients/{noah_id}/devices/{device_id}/open-fitting"
            )
            return r.status_code == 200

    def map_noah_patient_to_local(self, noah_data: dict) -> dict:
        """Convertit les données Noah vers le format local."""
        return {
            "noah_id": str(noah_data.get("PatientKey")),
            "first_name": noah_data.get("FirstName", ""),
            "last_name": noah_data.get("LastName", ""),
            "birth_date": noah_data.get("DateOfBirth"),
            "gender": "M" if noah_data.get("Gender") == 1 else "F",
            "nir": noah_data.get("NIR"),
        }

    def map_local_to_noah_patient(self, local_data: dict) -> dict:
        return {
            "FirstName": local_data.get("first_name"),
            "LastName": local_data.get("last_name"),
            "DateOfBirth": str(local_data.get("birth_date")),
            "Gender": 1 if local_data.get("gender") == "M" else 2,
            "NIR": local_data.get("nir"),
        }


noah4_service = Noah4Service()
