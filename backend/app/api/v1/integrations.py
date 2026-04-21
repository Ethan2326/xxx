from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import csv, io, unicodedata, re, uuid as _uuid
from app.database import get_db, AsyncSessionLocal
from app.services.noah4_service import noah4_service
from app.services.audiowizard_service import audiowizard_service
from app.services.cosium_service import cosium_service
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.patient import Patient
from uuid import UUID
from pydantic import BaseModel

router = APIRouter()

# Job store en mémoire pour les imports longs
_import_jobs: dict[str, dict] = {}


# ── Cosium sync helpers ───────────────────────────────────────────────────────

def _match_score(local: Patient, cosium: dict) -> int:
    l_nom = (local.last_name or "").lower().strip()
    c_nom = (cosium.get("last_name") or "").lower().strip()
    l_prenom = (local.first_name or "").lower().strip()
    c_prenom = (cosium.get("first_name") or "").lower().strip()

    nom_match = bool(l_nom and c_nom and l_nom == c_nom)
    prenom_match = bool(l_prenom and c_prenom and l_prenom == c_prenom)

    date_match = False
    if local.birth_date and cosium.get("birth_date"):
        try:
            ld = str(local.birth_date)[:10]
            cd = str(cosium["birth_date"])[:10]
            date_match = ld == cd
        except Exception:
            pass

    if nom_match and prenom_match and date_match:
        return 95
    if nom_match and date_match:
        return 80
    if nom_match and prenom_match:
        return 60
    if nom_match:
        return 30
    return 0


def _patient_summary(p: Patient) -> dict:
    return {
        "id": str(p.id),
        "first_name": p.first_name,
        "last_name": p.last_name,
        "birth_date": str(p.birth_date) if p.birth_date else None,
        "nir": p.nir,
        "cosium_id": p.cosium_id,
    }


class SyncLink(BaseModel):
    local_id: str
    cosium_id: str


@router.get("/status")
async def integration_status(_: User = Depends(get_current_user)):
    """Vérifie la connectivité de toutes les intégrations."""
    noah_ok = await noah4_service.ping()
    aw_ok = await audiowizard_service.ping()
    cosium_ok = await cosium_service.ping()
    return {
        "noah4": {"connected": noah_ok, "label": "Noah 4"},
        "audiowizard": {"connected": aw_ok, "label": "AudioWizard"},
        "cosium": {"connected": cosium_ok, "label": "Cosium"},
    }


# ── Noah 4 ────────────────────────────────────────────────────────────────────

@router.get("/noah4/patients")
async def noah_patients(_: User = Depends(get_current_user)):
    return await noah4_service.get_patients()


@router.get("/noah4/patients/{noah_id}/audiogram")
async def noah_audiogram(noah_id: str, _: User = Depends(get_current_user)):
    data = await noah4_service.get_latest_audiogram(noah_id)
    if not data:
        raise HTTPException(status_code=404, detail="Aucun audiogramme Noah")
    return data


@router.get("/noah4/patients/{noah_id}/devices")
async def noah_devices(noah_id: str, _: User = Depends(get_current_user)):
    return await noah4_service.get_devices(noah_id)


# ── AudioWizard ───────────────────────────────────────────────────────────────

@router.get("/audiowizard/patients")
async def aw_search_patients(q: str = "", _: User = Depends(get_current_user)):
    return await audiowizard_service.search_patients(q)


@router.get("/audiowizard/patients/{aw_id}")
async def aw_get_patient(aw_id: str, _: User = Depends(get_current_user)):
    data = await audiowizard_service.get_patient(aw_id)
    if not data:
        raise HTTPException(status_code=404, detail="Patient AudioWizard non trouvé")
    return data


@router.get("/audiowizard/catalog")
async def aw_catalog(fabricant: str = None, _: User = Depends(get_current_user)):
    return await audiowizard_service.get_catalog(fabricant)


# ── Cosium ────────────────────────────────────────────────────────────────────

@router.get("/cosium/patients")
async def cosium_search(nom: str = "", prenom: str = "", _: User = Depends(get_current_user)):
    return await cosium_service.search_patients(nom=nom, prenom=prenom)


@router.get("/cosium/patients/{cosium_id}")
async def cosium_patient(cosium_id: str, _: User = Depends(get_current_user)):
    data = await cosium_service.get_patient(cosium_id)
    if not data:
        raise HTTPException(status_code=404, detail="Patient Cosium non trouvé")
    return data


@router.get("/cosium/agenda")
async def cosium_agenda(
    date_debut: str,
    date_fin: str,
    _: User = Depends(get_current_user),
):
    from datetime import date
    d1 = date.fromisoformat(date_debut)
    d2 = date.fromisoformat(date_fin)
    return await cosium_service.get_agenda(d1, d2)


@router.get("/cosium/patients/{cosium_id}/appareils")
async def cosium_patient_appareils(cosium_id: str, _: User = Depends(get_current_user)):
    return await cosium_service.get_patient_appareils(cosium_id)


@router.get("/cosium/patients/{cosium_id}/devis")
async def cosium_patient_devis(cosium_id: str, _: User = Depends(get_current_user)):
    return await cosium_service.get_patient_devis(cosium_id)


@router.get("/cosium/patients/{cosium_id}/rdv")
async def cosium_patient_rdv(cosium_id: str, _: User = Depends(get_current_user)):
    return await cosium_service.get_patient_rdv(cosium_id)


@router.post("/cosium/patients/{patient_id}/link")
async def cosium_link_patient(
    patient_id: str,
    cosium_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Patient).where(Patient.id == UUID(patient_id)))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Patient non trouvé")
    patient.cosium_id = cosium_id
    await db.flush()
    return {"linked": True, "cosium_id": cosium_id}


# ── Cosium bulk sync ──────────────────────────────────────────────────────────

@router.get("/cosium/sync/preview")
async def cosium_sync_preview(
    max_cosium: int = Query(200, ge=10, le=500, description="Nombre max de patients Cosium à analyser"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Compare la base locale avec tous les patients Cosium et propose des liaisons.
    Retourne: matches (avec score), unmatched_local, total_cosium.
    """
    # Charge tous les patients locaux
    res = await db.execute(select(Patient))
    local_patients: list[Patient] = list(res.scalars().all())

    # Index NIR → patient local (pour match exact rapide)
    local_by_nir: dict[str, Patient] = {}
    for p in local_patients:
        if p.nir:
            local_by_nir[p.nir.replace(" ", "")] = p

    # IDs Cosium déjà liés
    already_linked: set[str] = {p.cosium_id for p in local_patients if p.cosium_id}

    # Récupère les patients Cosium
    cosium_patients = await cosium_service.get_all_patients_paginated(limit=max_cosium)

    matches = []
    used_local_ids: set[str] = set()

    for cp in cosium_patients:
        cosium_id = str(cp.get("id", ""))
        if not cosium_id or cosium_id in already_linked:
            continue

        cp_mapped = cosium_service.map_cosium_patient(cp)
        best_local: Optional[Patient] = None
        best_score = 0

        # 1. NIR exact
        cp_nir = (cp_mapped.get("nir") or "").replace(" ", "")
        if cp_nir and cp_nir in local_by_nir:
            candidate = local_by_nir[cp_nir]
            if str(candidate.id) not in used_local_ids:
                best_local = candidate
                best_score = 100
        else:
            # 2. Scoring nom/prénom/date
            for lp in local_patients:
                if lp.cosium_id or str(lp.id) in used_local_ids:
                    continue
                score = _match_score(lp, cp_mapped)
                if score > best_score:
                    best_score = score
                    best_local = lp

        local_summary = None
        local_id = None
        if best_local and best_score >= 50:
            local_summary = _patient_summary(best_local)
            local_id = str(best_local.id)
            used_local_ids.add(local_id)

        matches.append({
            "cosium_id": cosium_id,
            "cosium_patient": cp_mapped,
            "local_patient": local_summary,
            "local_patient_id": local_id,
            "score": best_score,
            "auto_match": best_score >= 90,
        })

    # Patients locaux sans aucune correspondance Cosium
    unmatched_local = [
        _patient_summary(p)
        for p in local_patients
        if not p.cosium_id and str(p.id) not in used_local_ids
    ]

    return {
        "matches": matches,
        "unmatched_local": unmatched_local,
        "total_cosium": len(cosium_patients),
        "total_local": len(local_patients),
    }


@router.post("/cosium/sync/apply")
async def cosium_sync_apply(
    links: list[SyncLink],
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Applique une liste de liaisons {local_id, cosium_id}."""
    applied = 0
    errors = []
    for link in links:
        try:
            res = await db.execute(select(Patient).where(Patient.id == UUID(link.local_id)))
            patient = res.scalar_one_or_none()
            if patient:
                patient.cosium_id = link.cosium_id
                applied += 1
            else:
                errors.append(f"Patient local {link.local_id} introuvable")
        except Exception as e:
            errors.append(str(e))
    await db.flush()
    return {"applied": applied, "errors": errors}


# ── CSV import Cosium ─────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    """Minuscule + supprime accents + espaces en trop."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


def _detect_columns(headers: list[str]) -> dict:
    """Détecte automatiquement les colonnes d'un export Cosium."""
    mapping = {}
    for i, h in enumerate(headers):
        hn = _normalize(h)
        if any(k in hn for k in ("id", "identifiant", "code patient", "num patient", "numero")):
            mapping.setdefault("cosium_id", i)
        if any(k in hn for k in ("nom", "name")) and "prenom" not in hn and "first" not in hn:
            mapping.setdefault("last_name", i)
        if any(k in hn for k in ("prenom", "prénom", "first name", "firstname")):
            mapping.setdefault("first_name", i)
        if any(k in hn for k in ("naissance", "birth", "ddn", "date de nai")):
            mapping.setdefault("birth_date", i)
        if any(k in hn for k in ("secu", "nir", "securite", "assure")):
            mapping.setdefault("nir", i)
    return mapping


def _parse_date(val: str) -> Optional[str]:
    """Tente de normaliser une date en YYYY-MM-DD."""
    val = (val or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            from datetime import datetime
            return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


@router.post("/cosium/import-csv/preview")
async def cosium_csv_preview(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Reçoit un fichier CSV/TSV exporté depuis Cosium.
    Retourne une liste de correspondances avec les patients locaux.
    """
    content = await file.read()
    # Essaie plusieurs encodages
    for enc in ("utf-8-sig", "latin-1", "cp1252"):
        try:
            text = content.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise HTTPException(400, "Impossible de lire le fichier (encodage non supporté)")

    # Détecte le séparateur
    sample = text[:2000]
    sep = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.reader(io.StringIO(text), delimiter=sep)
    rows = list(reader)
    if len(rows) < 2:
        raise HTTPException(400, "Fichier vide ou sans données")

    headers = rows[0]
    col = _detect_columns(headers)

    if "cosium_id" not in col and "last_name" not in col:
        raise HTTPException(400, detail={
            "message": "Colonnes non reconnues",
            "headers_found": headers,
            "hint": "Le fichier doit contenir au moins une colonne ID et une colonne Nom"
        })

    # Charge les patients locaux
    res = await db.execute(select(Patient))
    local_patients: list[Patient] = list(res.scalars().all())

    local_by_nir: dict[str, Patient] = {
        p.nir.replace(" ", ""): p for p in local_patients if p.nir
    }
    already_linked: set[str] = {p.cosium_id for p in local_patients if p.cosium_id}

    matches = []
    used_local_ids: set[str] = set()

    for row in rows[1:]:
        if not any(row):
            continue

        def cell(key: str) -> str:
            idx = col.get(key)
            return row[idx].strip() if idx is not None and idx < len(row) else ""

        cosium_id = cell("cosium_id")
        c_nom = cell("last_name")
        c_prenom = cell("first_name")
        c_ddn = _parse_date(cell("birth_date"))
        c_nir = cell("nir").replace(" ", "")

        if cosium_id in already_linked:
            continue

        cosium_patient = {
            "cosium_id": cosium_id,
            "last_name": c_nom,
            "first_name": c_prenom,
            "birth_date": c_ddn,
            "nir": c_nir or None,
        }

        best_local: Optional[Patient] = None
        best_score = 0

        # NIR exact
        if c_nir and c_nir in local_by_nir:
            candidate = local_by_nir[c_nir]
            if str(candidate.id) not in used_local_ids:
                best_local = candidate
                best_score = 100
        else:
            for lp in local_patients:
                if lp.cosium_id or str(lp.id) in used_local_ids:
                    continue
                cp_mapped = {"last_name": c_nom, "first_name": c_prenom, "birth_date": c_ddn, "nir": c_nir}
                score = _match_score(lp, cp_mapped)
                if score > best_score:
                    best_score = score
                    best_local = lp

        local_summary = None
        local_id = None
        if best_local and best_score >= 50:
            local_summary = _patient_summary(best_local)
            local_id = str(best_local.id)
            used_local_ids.add(local_id)

        matches.append({
            "cosium_id": cosium_id,
            "cosium_patient": cosium_patient,
            "local_patient": local_summary,
            "local_patient_id": local_id,
            "score": best_score,
            "auto_match": best_score >= 90,
        })

    unmatched_local = [
        _patient_summary(p)
        for p in local_patients
        if not p.cosium_id and str(p.id) not in used_local_ids
    ]

    return {
        "matches": matches,
        "unmatched_local": unmatched_local,
        "headers_detected": col,
        "total_csv_rows": len(rows) - 1,
        "total_local": len(local_patients),
    }


# ── Import direct Cosium → base locale (asynchrone) ──────────────────────────

async def _run_cosium_import(job_id: str, max_patients: int):
    """Tâche de fond : importe tous les patients Cosium. Met à jour _import_jobs."""
    from datetime import date as DateType
    job = _import_jobs[job_id]

    try:
        job["step"] = "connexion"
        cosium_raw = await cosium_service.get_all_customers(page_size=max_patients)
        job["total_cosium"] = len(cosium_raw)
        job["step"] = "import"

        async with AsyncSessionLocal() as db:
            res = await db.execute(select(Patient))
            existing = list(res.scalars().all())
            existing_cosium_ids = {p.cosium_id for p in existing if p.cosium_id}
            existing_nirs: dict[str, Patient] = {
                p.nir.replace(" ", ""): p for p in existing if p.nir
            }

            created, linked, skipped, errors = 0, 0, 0, []

            for i, cp in enumerate(cosium_raw):
                job["progress"] = i + 1
                mapped = cosium_service.map_cosium_patient(cp)
                cosium_id = mapped.get("cosium_id", "")
                nir_clean = (mapped.get("nir") or "").replace(" ", "")

                if cosium_id and cosium_id in existing_cosium_ids:
                    skipped += 1
                    continue

                if nir_clean and nir_clean in existing_nirs:
                    lp = existing_nirs[nir_clean]
                    if not lp.cosium_id:
                        lp.cosium_id = cosium_id
                        existing_cosium_ids.add(cosium_id)
                        linked += 1
                    else:
                        skipped += 1
                    continue

                if not mapped.get("first_name") or not mapped.get("last_name"):
                    errors.append(f"Cosium {cosium_id}: nom/prénom manquant")
                    continue

                birth_str = mapped.get("birth_date")
                if not birth_str:
                    continue  # silently skip — pas de date de naissance

                try:
                    birth_date = DateType.fromisoformat(birth_str[:10])
                except ValueError:
                    errors.append(f"Cosium {cosium_id}: date invalide '{birth_str}'")
                    continue

                try:
                    postal = (mapped.get("postal_code") or "")[:5] or None
                    patient = Patient(
                        cosium_id=cosium_id or None,
                        first_name=mapped["first_name"],
                        last_name=mapped["last_name"],
                        birth_date=birth_date,
                        gender=(mapped.get("gender") or "")[:1] or None,
                        nir=mapped.get("nir"),
                        phone=mapped.get("phone"),
                        mobile=mapped.get("mobile"),
                        email=mapped.get("email"),
                        address=mapped.get("address"),
                        city=mapped.get("city"),
                        postal_code=postal,
                        mutuelle=mapped.get("mutuelle"),
                        numero_adherent_mutuelle=mapped.get("numero_adherent_mutuelle"),
                    )
                    db.add(patient)
                    if cosium_id:
                        existing_cosium_ids.add(cosium_id)
                    if nir_clean:
                        existing_nirs[nir_clean] = patient
                    created += 1
                except Exception as e:
                    errors.append(f"Cosium {cosium_id}: {e}")

            await db.commit()

        job.update({
            "status": "done",
            "created": created,
            "linked": linked,
            "skipped": skipped,
            "errors": errors,
        })

    except Exception as e:
        job.update({"status": "error", "error": str(e)})


@router.post("/cosium/import-all/start")
async def cosium_import_start(
    background_tasks: BackgroundTasks,
    max_patients: int = Query(500, ge=10, le=2000),
    _: User = Depends(get_current_user),
):
    """Lance l'import en arrière-plan et retourne un job_id immédiatement."""
    job_id = str(_uuid.uuid4())[:8]
    _import_jobs[job_id] = {
        "status": "running",
        "step": "démarrage",
        "progress": 0,
        "total_cosium": 0,
    }
    background_tasks.add_task(_run_cosium_import, job_id, max_patients)
    return {"job_id": job_id}


@router.get("/cosium/import-all/status/{job_id}")
async def cosium_import_status(
    job_id: str,
    _: User = Depends(get_current_user),
):
    """Retourne l'état d'un import en cours."""
    job = _import_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job introuvable")
    return job


@router.get("/cosium/debug-login")
async def cosium_debug_login(_: User = Depends(get_current_user)):
    """
    Debug : teste le login Cosium étape par étape.
    Montre l'URL finale, le statut HTTP et si le formulaire Keycloak est trouvé.
    """
    import httpx as _httpx
    base = cosium_service.base_url
    result: dict = {"base_url": base, "username": cosium_service.username}

    if not base:
        return {"error": "COSIUM_URL non configuré"}

    async with _httpx.AsyncClient(
        follow_redirects=True, timeout=20,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
    ) as client:
        try:
            r1 = await client.get(f"{base}/classic/")
            result["url_finale"] = str(r1.url)
            result["status_http"] = r1.status_code
            result["cookies"] = list(client.cookies.keys())
            result["body_preview"] = r1.text[:500]

            action = re.search(r'action="([^"]+)"', r1.text)
            result["formulaire_keycloak_trouve"] = bool(action)
            if action:
                result["form_action"] = action.group(1)[:150].replace("&amp;", "&")
            else:
                result["hint"] = (
                    "Pas de formulaire trouvé. Soit déjà connecté, "
                    "soit la page ne redirige pas vers Keycloak. "
                    "Vérifiez body_preview."
                )
        except Exception as e:
            result["erreur"] = str(e)

    return result
