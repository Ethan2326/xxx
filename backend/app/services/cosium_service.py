"""
Service Cosium — connexion directe via session Keycloak (même mécanisme que le navigateur).
Endpoint : https://c1.cosium.biz/{site_id}/api/customers  (HAL-Forms JSON)
Auth     : Keycloak → cookies access_token + JSESSIONID
"""
import re
import httpx
from typing import Optional
from datetime import datetime, timedelta
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()

# Headers qui imitent Chrome — nécessaires pour que Keycloak accepte la requête
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/147.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7",
}

_HAL_ACCEPT = (
    "application/prs.hal-forms+json;q=1.0, "
    "application/hal+json;q=0.9, "
    "application/json;q=0.7"
)


class CosiumService:
    def __init__(self):
        # Ex: https://c1.cosium.biz/01OPTI01370
        self.base_url: str = (settings.COSIUM_URL or "").rstrip("/")
        self.username: str = settings.COSIUM_USERNAME
        self.password: str = settings.COSIUM_PASSWORD
        self._cookies: dict = {}
        self._session_expires: Optional[datetime] = None

    def _configured(self) -> bool:
        return bool(self.base_url and self.username and self.password)

    # ── Authentification Keycloak ─────────────────────────────────────────────

    async def _login(self):
        """
        Simule le flux de login navigateur :
        1. GET /classic/  → Keycloak redirige vers son formulaire
        2. Extrait l'action du formulaire (URL avec session_code + CSRF)
        3. POST login/password → Keycloak redirige vers Cosium
        4. Les cookies access_token + JSESSIONID sont capturés automatiquement
        """
        if not self._configured():
            raise Exception(
                "Cosium non configuré. Définissez COSIUM_URL, COSIUM_USERNAME, COSIUM_PASSWORD."
            )

        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=30,
            headers=_BROWSER_HEADERS,
        ) as client:
            # Étape 1 : accès à l'app → redirection Keycloak
            r1 = await client.get(f"{self.base_url}/classic/")

            # Étape 2 : trouver l'URL d'action du formulaire Keycloak
            action = re.search(r'action="([^"]+)"', r1.text)
            if not action:
                # Peut-être déjà connecté ou page inattendue
                if "classic" in str(r1.url) and r1.status_code == 200:
                    self._cookies = dict(client.cookies)
                    self._session_expires = datetime.utcnow() + timedelta(hours=8)
                    return
                raise Exception(
                    "Formulaire Keycloak introuvable. "
                    f"URL finale : {r1.url} — vérifiez COSIUM_URL."
                )

            login_url = action.group(1).replace("&amp;", "&")

            # Étape 3 : soumettre les identifiants
            r2 = await client.post(
                login_url,
                data={"username": self.username, "password": self.password},
                headers={
                    **_BROWSER_HEADERS,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": str(r1.url),
                },
            )

            # Vérifier l'échec (on reste sur la page Keycloak)
            if "kc-form-login" in r2.text or "login-actions" in str(r2.url):
                raise Exception(
                    "Identifiants Cosium incorrects — vérifiez COSIUM_USERNAME et COSIUM_PASSWORD."
                )

            # Étape 4 : stocker les cookies
            self._cookies = dict(client.cookies)
            self._session_expires = datetime.utcnow() + timedelta(hours=7, minutes=30)
            log.info("cosium_login_ok", site=self.base_url, cookies=list(self._cookies.keys()))

    async def _ensure_session(self):
        """Re-login si la session est expirée ou absente."""
        if not self._cookies or (
            self._session_expires and datetime.utcnow() >= self._session_expires
        ):
            await self._login()

    def _api_headers(self) -> dict:
        return {
            **_BROWSER_HEADERS,
            "Accept": _HAL_ACCEPT,
            "Referer": f"{self.base_url}/classic/",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }

    # ── Requêtes génériques ───────────────────────────────────────────────────

    async def _get(self, path: str, params: dict = None) -> dict | list:
        await self._ensure_session()
        async with httpx.AsyncClient(
            cookies=self._cookies,
            headers=self._api_headers(),
            follow_redirects=True,
            timeout=30,
        ) as client:
            url = f"{self.base_url}{path}" if path.startswith("/") else path
            r = await client.get(url, params=params or {})
            if r.status_code == 401:
                # Session expirée → re-login et retry
                await self._login()
                async with httpx.AsyncClient(
                    cookies=self._cookies,
                    headers=self._api_headers(),
                    follow_redirects=True,
                    timeout=30,
                ) as client2:
                    r = await client2.get(url, params=params or {})
            r.raise_for_status()
            return r.json()

    # ── Santé ─────────────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        if not self._configured():
            return False
        try:
            await self._ensure_session()
            async with httpx.AsyncClient(
                cookies=self._cookies,
                headers=self._api_headers(),
                follow_redirects=True,
                timeout=10,
            ) as client:
                r = await client.get(f"{self.base_url}/api/legacy/sessionuser")
                return r.status_code == 200
        except Exception as e:
            log.warning("cosium_ping_failed", error=str(e))
            return False

    # ── Patients (customers) ──────────────────────────────────────────────────

    async def get_all_customers(self, page: int = 0, page_size: int = 200) -> list[dict]:
        """Récupère tous les patients Cosium (format HAL). Lève une exception si échec."""
        data = await self._get("/api/customers", {
            "embed": "accounting,address,hearing-aid-specialist,optician,site,tags",
            "page_number": page,
            "page_size": page_size,
            "sort": ["lastName,ASC", "firstName,ASC"],
        })
        return self._extract_list(data, ["customers", "tiers", "client", "items"]) or []

    async def search_patients(self, nom: str = "", prenom: str = "", nir: str = "") -> list[dict]:
        params = {
            "embed": "address",
            "page_number": 0,
            "page_size": 30,
        }
        if nom:
            params["lastName"] = nom
        if prenom:
            params["firstName"] = prenom
        try:
            data = await self._get("/api/customers", params)
            return self._extract_list(data, ["customers", "tiers", "client", "items"])
        except Exception:
            return []

    async def get_patient(self, cosium_id: str) -> Optional[dict]:
        try:
            return await self._get(f"/api/customers/{cosium_id}", {
                "embed": "accounting,address,hearing-aid-specialist,optician,site,tags"
            })
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_patient_appareils(self, cosium_id: str) -> list[dict]:
        """Récupère les appareils auditifs d'un patient."""
        try:
            data = await self._get(f"/api/customers/{cosium_id}", {
                "embed": "hearing-aid-specialist"
            })
            ha = (data.get("_embedded") or {}).get("hearing-aid-specialist") or {}
            # Tente différentes clés selon version Cosium
            for key in ("hearingAids", "devices", "appareils", "items"):
                if key in ha:
                    return ha[key]
            # Fallback : endpoint dédié
            sales = await self._get(f"/api/customers/{cosium_id}/sale-items", {
                "type": "HEARING_AID"
            })
            return self._extract_list(sales, ["saleItems", "items", "data"])
        except Exception as e:
            log.warning("cosium_appareils_error", cosium_id=cosium_id, error=str(e))
            return []

    async def get_patient_devis(self, cosium_id: str) -> list[dict]:
        """Récupère les devis d'un patient."""
        for path in (
            f"/api/customers/{cosium_id}/quotations",
            f"/api/customers/{cosium_id}/devis",
            f"/api/quotations?customerId={cosium_id}",
        ):
            try:
                data = await self._get(path)
                result = self._extract_list(data, ["quotations", "devis", "items", "data"])
                if result is not None:
                    return result
            except Exception:
                continue
        return []

    async def get_patient_rdv(self, cosium_id: str) -> list[dict]:
        """Récupère les rendez-vous d'un patient."""
        for path in (
            f"/api/customers/{cosium_id}/appointments",
            f"/api/customers/{cosium_id}/rdv",
            f"/api/agenda?customerId={cosium_id}",
        ):
            try:
                data = await self._get(path)
                result = self._extract_list(data, ["appointments", "rdv", "items", "data"])
                if result is not None:
                    return result
            except Exception:
                continue
        return []

    async def get_all_patients_paginated(self, offset: int = 0, limit: int = 200) -> list[dict]:
        """Alias pour la synchro bulk existante."""
        page = offset // limit if limit else 0
        raw = await self.get_all_customers(page=page, page_size=limit)
        return [self.map_cosium_patient(c) for c in raw]

    # ── Agenda global ─────────────────────────────────────────────────────────

    async def get_agenda(self, date_debut, date_fin, praticien_id=None) -> list[dict]:
        params = {
            "dateFrom": str(date_debut),
            "dateTo": str(date_fin),
        }
        if praticien_id:
            params["practitionerId"] = praticien_id
        try:
            data = await self._get("/api/agenda", params)
            return self._extract_list(data, ["appointments", "rdv", "items"])
        except Exception:
            return []

    # ── Mapping ───────────────────────────────────────────────────────────────

    def map_cosium_patient(self, c: dict) -> dict:
        """Convertit un customer Cosium (HAL) en format patient local."""
        addr = c.get("address") or (c.get("_embedded") or {}).get("address") or {}
        accounting = c.get("accounting") or (c.get("_embedded") or {}).get("accounting") or {}
        org = accounting.get("insuranceOrganization") or accounting.get("mutuelle") or {}

        gender_raw = c.get("gender") or {}
        gender = gender_raw.get("value", "") if isinstance(gender_raw, dict) else str(gender_raw)

        nir = (
            c.get("socialSecurityNumber")
            or c.get("nirNumber")
            or c.get("nir")
            or accounting.get("socialSecurityNumber")
        )

        return {
            "cosium_id": str(c.get("id", "")),
            "first_name": c.get("firstName", ""),
            "last_name": c.get("lastName", ""),
            "birth_date": (c.get("birthDate") or "")[:10] or None,
            "gender": gender[:1] if gender else None,
            "nir": nir,
            "phone": c.get("phone") or c.get("landlinePhone"),
            "mobile": c.get("mobile") or c.get("mobilePhone"),
            "email": c.get("email"),
            "address": addr.get("street") or addr.get("address") or addr.get("line1"),
            "city": addr.get("city"),
            "postal_code": addr.get("zip") or addr.get("postalCode"),
            "mutuelle": org.get("name") or org.get("nom"),
            "numero_adherent_mutuelle": accounting.get("memberNumber") or accounting.get("numeroAdherent"),
        }

    def map_local_to_cosium(self, p: dict) -> dict:
        return {
            "lastName": p.get("last_name", ""),
            "firstName": p.get("first_name", ""),
            "birthDate": str(p.get("birth_date", "")),
            "gender": p.get("gender", ""),
            "socialSecurityNumber": p.get("nir"),
            "phone": p.get("phone"),
            "mobile": p.get("mobile"),
            "email": p.get("email"),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_list(data, keys: list[str]) -> Optional[list]:
        """Extrait une liste depuis un objet HAL ou JSON simple."""
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            embedded = data.get("_embedded") or {}
            for key in keys:
                if key in embedded:
                    return embedded[key]
                if key in data:
                    v = data[key]
                    if isinstance(v, list):
                        return v
        return []


cosium_service = CosiumService()
