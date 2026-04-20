from fastapi import APIRouter, Depends, HTTPException
from app.services.noah4_service import noah4_service
from app.services.audiowizard_service import audiowizard_service
from app.services.cosium_service import cosium_service
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter()


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
