"""
Service d'intégration Cosium.
Cosium est un logiciel ERP pour opticiens et audioprothésistes très répandu en France.
Il fournit une API REST pour la gestion des patients, RDV, ventes et facturation.
"""

import httpx
from typing import Optional
from datetime import date, datetime
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()


class CosiumService:
    def __init__(self):
        self.base_url = settings.COSIUM_URL.rstrip("/")
        self._token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    async def _authenticate(self) -> str:
        """Authentification OAuth2 Cosium."""
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{self.base_url}/oauth/token",
                data={
                    "grant_type": "password",
                    "username": settings.COSIUM_USERNAME,
                    "password": settings.COSIUM_PASSWORD,
                    "client_id": "audioassist",
                }
            )
            r.raise_for_status()
            data = r.json()
            self._token = data["access_token"]
            return self._token

    async def _get_token(self) -> str:
        if not self._token or (
            self._token_expires and datetime.utcnow() >= self._token_expires
        ):
            return await self._authenticate()
        return self._token

    async def _headers(self) -> dict:
        token = await self._get_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _get(self, path: str, params: dict = None) -> dict | list:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                f"{self.base_url}{path}",
                headers=await self._headers(),
                params=params or {}
            )
            r.raise_for_status()
            return r.json()

    async def _post(self, path: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{self.base_url}{path}",
                headers=await self._headers(),
                json=data
            )
            r.raise_for_status()
            return r.json()

    async def _put(self, path: str, data: dict) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.put(
                f"{self.base_url}{path}",
                headers=await self._headers(),
                json=data
            )
            r.raise_for_status()
            return r.json()

    async def ping(self) -> bool:
        try:
            await self._get("/api/v2/centres/current")
            return True
        except Exception:
            return False

    # ── Patients ──────────────────────────────────────────────────────────────

    async def search_patients(self, nom: str = "", prenom: str = "", nir: str = "") -> list[dict]:
        params = {}
        if nom:
            params["nom"] = nom
        if prenom:
            params["prenom"] = prenom
        if nir:
            params["nir"] = nir
        return await self._get("/api/v2/patients", params)

    async def get_patient(self, cosium_id: str) -> Optional[dict]:
        try:
            return await self._get(f"/api/v2/patients/{cosium_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_patient(self, data: dict) -> dict:
        return await self._post("/api/v2/patients", data)

    async def update_patient(self, cosium_id: str, data: dict) -> dict:
        return await self._put(f"/api/v2/patients/{cosium_id}", data)

    # ── Rendez-vous ───────────────────────────────────────────────────────────

    async def get_agenda(
        self,
        date_debut: date,
        date_fin: date,
        praticien_id: Optional[str] = None
    ) -> list[dict]:
        params = {
            "dateDebut": date_debut.isoformat(),
            "dateFin": date_fin.isoformat(),
        }
        if praticien_id:
            params["praticienId"] = praticien_id
        return await self._get("/api/v2/agenda", params)

    async def create_rdv(self, data: dict) -> dict:
        return await self._post("/api/v2/agenda", data)

    async def update_rdv(self, rdv_id: str, data: dict) -> dict:
        return await self._put(f"/api/v2/agenda/{rdv_id}", data)

    async def get_patient_rdv(self, cosium_id: str) -> list[dict]:
        return await self._get(f"/api/v2/patients/{cosium_id}/rdv")

    async def get_patient_appareils(self, cosium_id: str) -> list[dict]:
        """Récupère les appareils auditifs d'un patient."""
        try:
            return await self._get(f"/api/v2/patients/{cosium_id}/appareillages")
        except Exception:
            # Fallback sur ventes filtrées
            ventes = await self._get(f"/api/v2/patients/{cosium_id}/ventes")
            return [v for v in ventes if v.get("type") in ("APPAREIL", "APPAREILLAGE")]

    async def get_patient_devis(self, cosium_id: str) -> list[dict]:
        """Récupère les devis d'un patient."""
        return await self._get(f"/api/v2/patients/{cosium_id}/devis")

    async def get_all_patients_paginated(self, offset: int = 0, limit: int = 200) -> list[dict]:
        """Récupère tous les patients Cosium (pagination offset/limit)."""
        try:
            result = await self._get("/api/v2/patients", {"_start": offset, "_limit": limit})
            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                for key in ("data", "items", "patients", "results"):
                    if key in result:
                        return result[key]
            return []
        except Exception as e:
            log.warning("cosium_all_patients_error", error=str(e))
            return []

    # ── Ventes / Facturation ──────────────────────────────────────────────────

    async def get_ventes(self, cosium_id: str) -> list[dict]:
        return await self._get(f"/api/v2/patients/{cosium_id}/ventes")

    async def create_devis(self, data: dict) -> dict:
        """Crée un devis dans Cosium."""
        return await self._post("/api/v2/devis", data)

    async def get_devis(self, devis_id: str) -> dict:
        return await self._get(f"/api/v2/devis/{devis_id}")

    # ── Caisse / Paiements ────────────────────────────────────────────────────

    async def get_encaissements(self, cosium_id: str) -> list[dict]:
        return await self._get(f"/api/v2/patients/{cosium_id}/encaissements")

    # ── Stock ─────────────────────────────────────────────────────────────────

    async def get_stock(self, reference: Optional[str] = None) -> list[dict]:
        params = {}
        if reference:
            params["reference"] = reference
        return await self._get("/api/v2/stock", params)

    # ── Mapping ───────────────────────────────────────────────────────────────

    def map_cosium_patient(self, c: dict) -> dict:
        return {
            "cosium_id": str(c.get("id")),
            "first_name": c.get("prenom", ""),
            "last_name": c.get("nom", ""),
            "birth_date": c.get("dateNaissance"),
            "gender": c.get("civilite", "M")[:1],
            "nir": c.get("numeroSecu"),
            "mutuelle": c.get("organisme", {}).get("nom"),
            "numero_adherent_mutuelle": c.get("numeroAdherent"),
            "phone": c.get("telephone"),
            "mobile": c.get("mobile"),
            "email": c.get("email"),
            "address": c.get("adresse"),
            "city": c.get("ville"),
            "postal_code": c.get("codePostal"),
        }

    def map_local_to_cosium(self, p: dict) -> dict:
        return {
            "nom": p.get("last_name", ""),
            "prenom": p.get("first_name", ""),
            "dateNaissance": str(p.get("birth_date", "")),
            "civilite": p.get("gender", "M"),
            "numeroSecu": p.get("nir"),
            "telephone": p.get("phone"),
            "mobile": p.get("mobile"),
            "email": p.get("email"),
            "adresse": p.get("address"),
            "ville": p.get("city"),
            "codePostal": p.get("postal_code"),
        }


cosium_service = CosiumService()
