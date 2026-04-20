"""
Service d'intégration AudioWizard.
AudioWizard est un logiciel de gestion de cabinet audioprothétique français.
Il expose une API REST pour l'accès aux données patient, audiogrammes et RDV.
"""

import httpx
from typing import Optional
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()


class AudioWizardService:
    def __init__(self):
        self.base_url = settings.AUDIOWIZARD_URL.rstrip("/")
        self.api_key = settings.AUDIOWIZARD_API_KEY
        self.headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _get(self, path: str, params: dict = None) -> dict | list:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                params=params or {}
            )
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base_url}{path}",
                headers=self.headers,
                json=data
            )
            r.raise_for_status()
            return r.json()

    async def ping(self) -> bool:
        try:
            await self._get("/api/v1/health")
            return True
        except Exception:
            return False

    # ── Patients ──────────────────────────────────────────────────────────────

    async def search_patients(self, query: str) -> list[dict]:
        return await self._get("/api/v1/patients", {"q": query})

    async def get_patient(self, aw_id: str) -> Optional[dict]:
        try:
            return await self._get(f"/api/v1/patients/{aw_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_patient(self, data: dict) -> dict:
        return await self._post("/api/v1/patients", data)

    # ── Audiogrammes ──────────────────────────────────────────────────────────

    async def get_audiograms(self, aw_patient_id: str) -> list[dict]:
        return await self._get(f"/api/v1/patients/{aw_patient_id}/audiograms")

    async def get_latest_audiogram(self, aw_patient_id: str) -> Optional[dict]:
        audiograms = await self.get_audiograms(aw_patient_id)
        if not audiograms:
            return None
        return sorted(audiograms, key=lambda x: x.get("date", ""), reverse=True)[0]

    async def create_audiogram(self, aw_patient_id: str, data: dict) -> dict:
        return await self._post(f"/api/v1/patients/{aw_patient_id}/audiograms", data)

    # ── Appareils auditifs ────────────────────────────────────────────────────

    async def get_devices(self, aw_patient_id: str) -> list[dict]:
        return await self._get(f"/api/v1/patients/{aw_patient_id}/appareils")

    # ── Rendez-vous ───────────────────────────────────────────────────────────

    async def get_appointments(self, aw_patient_id: str) -> list[dict]:
        return await self._get(f"/api/v1/patients/{aw_patient_id}/rdv")

    async def create_appointment(self, data: dict) -> dict:
        return await self._post("/api/v1/rdv", data)

    # ── Catalogue produits ────────────────────────────────────────────────────

    async def get_catalog(self, fabricant: Optional[str] = None) -> list[dict]:
        params = {}
        if fabricant:
            params["fabricant"] = fabricant
        return await self._get("/api/v1/catalogue", params)

    # ── Mapping ───────────────────────────────────────────────────────────────

    def map_aw_patient(self, aw: dict) -> dict:
        return {
            "audiowizard_id": str(aw.get("id")),
            "first_name": aw.get("prenom", ""),
            "last_name": aw.get("nom", ""),
            "birth_date": aw.get("dateNaissance"),
            "gender": aw.get("sexe", "").upper()[:1],
            "nir": aw.get("numeroSecuriteSociale"),
            "mutuelle": aw.get("mutuelle", {}).get("nom"),
        }

    def map_aw_audiogram(self, aw: dict) -> dict:
        """Convertit un audiogramme AudioWizard vers le format local."""
        return {
            "type": "tonal",
            "date_mesure": aw.get("date"),
            "seuils_od_ca": aw.get("seuilsOD", {}).get("aerienne"),
            "seuils_od_co": aw.get("seuilsOD", {}).get("osseuse"),
            "seuils_og_ca": aw.get("seuilsOG", {}).get("aerienne"),
            "seuils_og_co": aw.get("seuilsOG", {}).get("osseuse"),
            "vocal_od_intelligibilite": aw.get("vocalOD"),
            "vocal_og_intelligibilite": aw.get("vocalOG"),
            "commentaire": aw.get("commentaire"),
        }


audiowizard_service = AudioWizardService()
