from fastapi import APIRouter, Query
import httpx
from typing import Optional

router = APIRouter()

ANS_FHIR_URL = "https://gateway.api.esante.gouv.fr/fhir/v1"
# Spécialités : SM54 = Médecine générale, OTO = ORL
SPEC_MG = "SM54"
SPEC_ORL = "OTO"


def _parse_practitioner(entry: dict) -> dict | None:
    res = entry.get("resource", {})
    if res.get("resourceType") != "Practitioner":
        return None

    name_block = next((n for n in res.get("name", []) if n.get("use") == "official"), None)
    if not name_block:
        name_block = (res.get("name") or [{}])[0]

    family = name_block.get("family", "")
    given = " ".join(name_block.get("given", []))

    rpps, adeli = None, None
    for ident in res.get("identifier", []):
        system = ident.get("system", "")
        if "rpps" in system.lower():
            rpps = ident.get("value")
        elif "adeli" in system.lower():
            adeli = ident.get("value")

    qualification = None
    for q in res.get("qualification", []):
        code = q.get("code", {}).get("coding", [{}])[0].get("display", "")
        if code:
            qualification = code
            break

    return {
        "nom": f"{family} {given}".strip(),
        "prenom": given,
        "nom_famille": family,
        "rpps": rpps,
        "adeli": adeli,
        "specialite": qualification,
    }


@router.get("")
async def search_prescripteurs(
    q: str = Query(..., min_length=2, description="Nom, RPPS ou ADELI"),
    specialite: Optional[str] = Query(None, description="mg|orl|all"),
):
    results = []

    # Build ANS FHIR params
    params: dict = {"_count": "30", "_format": "json"}

    # RPPS = 11 digits, ADELI = 9 digits
    if q.isdigit() and len(q) >= 8:
        params["identifier"] = q
    else:
        params["family"] = q

    headers = {"Accept": "application/fhir+json"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{ANS_FHIR_URL}/Practitioner", params=params, headers=headers)
            if resp.status_code == 200:
                bundle = resp.json()
                for entry in bundle.get("entry", []):
                    parsed = _parse_practitioner(entry)
                    if parsed:
                        results.append(parsed)
    except Exception:
        pass

    # Deduplicate by RPPS
    seen = set()
    unique = []
    for r in results:
        key = r.get("rpps") or r["nom"]
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique[:25]
