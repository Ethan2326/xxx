from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date, datetime
import json

from app.database import get_db
from app.models.billing import Devis, Facture, LPP_FORFAITS, TAUX_TVA
from app.models.patient import Patient
from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter()


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class LigneCreate(BaseModel):
    designation: str
    quantite: float = 1
    prix_ht: float
    tva: float = 20.0


class DevisCreate(BaseModel):
    patient_id: UUID
    date_devis: date
    date_validite: Optional[date] = None
    # OD
    appareil_od_marque: Optional[str] = None
    appareil_od_modele: Optional[str] = None
    appareil_od_reference: Optional[str] = None
    appareil_od_classe_lpp: Optional[int] = None
    appareil_od_prix_ht: Optional[float] = None
    # OG
    appareil_og_marque: Optional[str] = None
    appareil_og_modele: Optional[str] = None
    appareil_og_reference: Optional[str] = None
    appareil_og_classe_lpp: Optional[int] = None
    appareil_og_prix_ht: Optional[float] = None
    # Financier
    remboursement_secu: Optional[float] = None
    remboursement_mutuelle: Optional[float] = None
    # Lignes supplémentaires
    lignes: list[LigneCreate] = []
    notes: Optional[str] = None


class DevisUpdate(BaseModel):
    statut: Optional[str] = None
    remboursement_secu: Optional[float] = None
    remboursement_mutuelle: Optional[float] = None
    notes: Optional[str] = None


class FactureCreate(BaseModel):
    patient_id: UUID
    devis_id: Optional[UUID] = None
    date_facture: date
    lignes: list[LigneCreate] = []
    notes: Optional[str] = None


class FactureUpdate(BaseModel):
    statut: Optional[str] = None
    montant_paye: Optional[float] = None
    notes: Optional[str] = None


class DevisRead(BaseModel):
    id: UUID
    patient_id: UUID
    numero: str
    statut: str
    date_devis: date
    date_validite: Optional[date]
    appareil_od_marque: Optional[str]
    appareil_od_modele: Optional[str]
    appareil_od_reference: Optional[str]
    appareil_od_classe_lpp: Optional[int]
    appareil_od_prix_ht: Optional[float]
    appareil_og_marque: Optional[str]
    appareil_og_modele: Optional[str]
    appareil_og_reference: Optional[str]
    appareil_og_classe_lpp: Optional[int]
    appareil_og_prix_ht: Optional[float]
    base_remboursement_secu: Optional[float]
    remboursement_secu: Optional[float]
    remboursement_mutuelle: Optional[float]
    reste_a_charge: Optional[float]
    lignes_json: Optional[str]
    montant_total_ht: Optional[float]
    montant_tva: Optional[float]
    montant_ttc: Optional[float]
    notes: Optional[str]
    created_at: datetime
    patient_nom: Optional[str] = None

    class Config:
        from_attributes = True


class FactureRead(BaseModel):
    id: UUID
    patient_id: UUID
    devis_id: Optional[UUID]
    numero: str
    statut: str
    date_facture: date
    montant_ttc: Optional[float]
    montant_paye: Optional[float]
    reste_a_payer: Optional[float]
    lignes_json: Optional[str]
    notes: Optional[str]
    created_at: datetime
    patient_nom: Optional[str] = None

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _next_numero(db: AsyncSession, prefix: str, table) -> str:
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count()).select_from(table)
        .where(table.numero.like(f"{prefix}-{year}-%"))
    )
    count = result.scalar() or 0
    return f"{prefix}-{year}-{count + 1:04d}"


def _compute_devis_totals(data: DevisCreate) -> dict:
    base_secu = 0.0
    total_appareils_ht = 0.0

    if data.appareil_od_prix_ht and data.appareil_od_classe_lpp:
        total_appareils_ht += data.appareil_od_prix_ht
        base_secu += LPP_FORFAITS.get(data.appareil_od_classe_lpp, {}).get("od", 0)

    if data.appareil_og_prix_ht and data.appareil_og_classe_lpp:
        total_appareils_ht += data.appareil_og_prix_ht
        base_secu += LPP_FORFAITS.get(data.appareil_og_classe_lpp, {}).get("og", 0)

    lignes_total_ht = sum(l.prix_ht * l.quantite for l in data.lignes)
    tva_appareils = total_appareils_ht * TAUX_TVA
    tva_lignes = sum(l.prix_ht * l.quantite * l.tva / 100 for l in data.lignes)

    montant_ht = total_appareils_ht + lignes_total_ht
    montant_tva = tva_appareils + tva_lignes
    montant_ttc = montant_ht + montant_tva

    remb_secu = data.remboursement_secu if data.remboursement_secu is not None else base_secu
    remb_mutuelle = data.remboursement_mutuelle or 0.0
    reste = montant_ttc - remb_secu - remb_mutuelle

    return {
        "base_remboursement_secu": base_secu,
        "remboursement_secu": remb_secu,
        "remboursement_mutuelle": remb_mutuelle,
        "reste_a_charge": max(0, reste),
        "montant_total_ht": montant_ht,
        "montant_tva": montant_tva,
        "montant_ttc": montant_ttc,
    }


def _devis_to_read(d: Devis, patient: Patient | None = None) -> DevisRead:
    data = DevisRead.model_validate(d)
    if patient:
        data.patient_nom = f"{patient.last_name.upper()} {patient.first_name}"
    return data


def _facture_to_read(f: Facture, patient: Patient | None = None) -> FactureRead:
    data = FactureRead.model_validate(f)
    if patient:
        data.patient_nom = f"{patient.last_name.upper()} {patient.first_name}"
    return data


# ── Devis ─────────────────────────────────────────────────────────────────────

@router.get("/devis", response_model=list[DevisRead])
async def list_devis(
    patient_id: Optional[UUID] = Query(None),
    statut: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Devis).order_by(Devis.created_at.desc())
    if patient_id:
        q = q.where(Devis.patient_id == patient_id)
    if statut:
        q = q.where(Devis.statut == statut)
    result = await db.execute(q)
    devis_list = result.scalars().all()

    patient_ids = {d.patient_id for d in devis_list}
    patients = {}
    if patient_ids:
        pr = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        patients = {p.id: p for p in pr.scalars().all()}

    return [_devis_to_read(d, patients.get(d.patient_id)) for d in devis_list]


@router.post("/devis", response_model=DevisRead, status_code=201)
async def create_devis(
    data: DevisCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    patient_r = await db.execute(select(Patient).where(Patient.id == data.patient_id))
    patient = patient_r.scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Patient non trouvé")

    numero = await _next_numero(db, "DEV", Devis)
    totals = _compute_devis_totals(data)

    from datetime import timedelta
    devis = Devis(
        patient_id=data.patient_id,
        numero=numero,
        statut="brouillon",
        date_devis=data.date_devis,
        date_validite=data.date_validite or (data.date_devis + timedelta(days=30)),
        appareil_od_marque=data.appareil_od_marque,
        appareil_od_modele=data.appareil_od_modele,
        appareil_od_reference=data.appareil_od_reference,
        appareil_od_classe_lpp=data.appareil_od_classe_lpp,
        appareil_od_prix_ht=data.appareil_od_prix_ht,
        appareil_og_marque=data.appareil_og_marque,
        appareil_og_modele=data.appareil_og_modele,
        appareil_og_reference=data.appareil_og_reference,
        appareil_og_classe_lpp=data.appareil_og_classe_lpp,
        appareil_og_prix_ht=data.appareil_og_prix_ht,
        lignes_json=json.dumps([l.model_dump() for l in data.lignes], ensure_ascii=False),
        notes=data.notes,
        **totals,
    )
    db.add(devis)
    await db.flush()
    await db.refresh(devis)
    return _devis_to_read(devis, patient)


@router.get("/devis/{devis_id}", response_model=DevisRead)
async def get_devis(
    devis_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Devis).where(Devis.id == devis_id))
    devis = r.scalar_one_or_none()
    if not devis:
        raise HTTPException(404, "Devis non trouvé")
    pr = await db.execute(select(Patient).where(Patient.id == devis.patient_id))
    patient = pr.scalar_one_or_none()
    return _devis_to_read(devis, patient)


@router.patch("/devis/{devis_id}", response_model=DevisRead)
async def update_devis(
    devis_id: UUID,
    data: DevisUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Devis).where(Devis.id == devis_id))
    devis = r.scalar_one_or_none()
    if not devis:
        raise HTTPException(404, "Devis non trouvé")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(devis, field, value)
    if data.remboursement_secu is not None or data.remboursement_mutuelle is not None:
        remb_s = float(data.remboursement_secu or devis.remboursement_secu or 0)
        remb_m = float(data.remboursement_mutuelle or devis.remboursement_mutuelle or 0)
        ttc = float(devis.montant_ttc or 0)
        devis.reste_a_charge = max(0, ttc - remb_s - remb_m)
    await db.flush()
    await db.refresh(devis)
    pr = await db.execute(select(Patient).where(Patient.id == devis.patient_id))
    return _devis_to_read(devis, pr.scalar_one_or_none())


@router.delete("/devis/{devis_id}", status_code=204)
async def delete_devis(
    devis_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Devis).where(Devis.id == devis_id))
    devis = r.scalar_one_or_none()
    if not devis:
        raise HTTPException(404, "Devis non trouvé")
    await db.delete(devis)


@router.get("/devis/{devis_id}/pdf")
async def get_devis_pdf(
    devis_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Devis).where(Devis.id == devis_id))
    devis = r.scalar_one_or_none()
    if not devis:
        raise HTTPException(404, "Devis non trouvé")
    pr = await db.execute(select(Patient).where(Patient.id == devis.patient_id))
    patient = pr.scalar_one_or_none()

    html = _build_devis_html(devis, patient)
    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        media_type = "application/pdf"
        filename = f"Devis_{devis.numero}.pdf"
    except ImportError:
        return Response(content=html, media_type="text/html")

    return Response(
        content=pdf_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Factures ──────────────────────────────────────────────────────────────────

@router.get("/factures", response_model=list[FactureRead])
async def list_factures(
    patient_id: Optional[UUID] = Query(None),
    statut: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Facture).order_by(Facture.created_at.desc())
    if patient_id:
        q = q.where(Facture.patient_id == patient_id)
    if statut:
        q = q.where(Facture.statut == statut)
    result = await db.execute(q)
    factures = result.scalars().all()

    patient_ids = {f.patient_id for f in factures}
    patients = {}
    if patient_ids:
        pr = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        patients = {p.id: p for p in pr.scalars().all()}

    return [_facture_to_read(f, patients.get(f.patient_id)) for f in factures]


@router.post("/factures", response_model=FactureRead, status_code=201)
async def create_facture(
    data: FactureCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    patient_r = await db.execute(select(Patient).where(Patient.id == data.patient_id))
    patient = patient_r.scalar_one_or_none()
    if not patient:
        raise HTTPException(404, "Patient non trouvé")

    numero = await _next_numero(db, "FAC", Facture)

    montant_ht = sum(l.prix_ht * l.quantite for l in data.lignes)
    montant_tva = sum(l.prix_ht * l.quantite * l.tva / 100 for l in data.lignes)
    montant_ttc = montant_ht + montant_tva

    # Si générée depuis un devis, reprendre ses montants
    devis = None
    if data.devis_id:
        dr = await db.execute(select(Devis).where(Devis.id == data.devis_id))
        devis = dr.scalar_one_or_none()
        if devis and not data.lignes:
            montant_ttc = float(devis.montant_ttc or 0)

    facture = Facture(
        patient_id=data.patient_id,
        devis_id=data.devis_id,
        numero=numero,
        statut="emise",
        date_facture=data.date_facture,
        montant_ttc=montant_ttc,
        montant_paye=0,
        reste_a_payer=montant_ttc,
        lignes_json=json.dumps([l.model_dump() for l in data.lignes], ensure_ascii=False),
        notes=data.notes,
    )
    db.add(facture)

    # Marquer le devis comme accepté
    if devis and devis.statut not in ("accepte", "facture"):
        devis.statut = "facture"

    await db.flush()
    await db.refresh(facture)
    return _facture_to_read(facture, patient)


@router.get("/factures/{facture_id}", response_model=FactureRead)
async def get_facture(
    facture_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Facture).where(Facture.id == facture_id))
    facture = r.scalar_one_or_none()
    if not facture:
        raise HTTPException(404, "Facture non trouvée")
    pr = await db.execute(select(Patient).where(Patient.id == facture.patient_id))
    return _facture_to_read(facture, pr.scalar_one_or_none())


@router.patch("/factures/{facture_id}", response_model=FactureRead)
async def update_facture(
    facture_id: UUID,
    data: FactureUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Facture).where(Facture.id == facture_id))
    facture = r.scalar_one_or_none()
    if not facture:
        raise HTTPException(404, "Facture non trouvée")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(facture, field, value)
    if data.montant_paye is not None:
        ttc = float(facture.montant_ttc or 0)
        paye = float(data.montant_paye)
        facture.reste_a_payer = max(0, ttc - paye)
        if facture.reste_a_payer == 0:
            facture.statut = "payee"
        elif paye > 0:
            facture.statut = "partiellement_payee"
    await db.flush()
    await db.refresh(facture)
    pr = await db.execute(select(Patient).where(Patient.id == facture.patient_id))
    return _facture_to_read(facture, pr.scalar_one_or_none())


@router.delete("/factures/{facture_id}", status_code=204)
async def delete_facture(
    facture_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Facture).where(Facture.id == facture_id))
    facture = r.scalar_one_or_none()
    if not facture:
        raise HTTPException(404, "Facture non trouvée")
    await db.delete(facture)


@router.get("/factures/{facture_id}/pdf")
async def get_facture_pdf(
    facture_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    r = await db.execute(select(Facture).where(Facture.id == facture_id))
    facture = r.scalar_one_or_none()
    if not facture:
        raise HTTPException(404, "Facture non trouvée")
    pr = await db.execute(select(Patient).where(Patient.id == facture.patient_id))
    patient = pr.scalar_one_or_none()

    devis = None
    if facture.devis_id:
        dr = await db.execute(select(Devis).where(Devis.id == facture.devis_id))
        devis = dr.scalar_one_or_none()

    html = _build_facture_html(facture, patient, devis)
    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html).write_pdf()
        filename = f"Facture_{facture.numero}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ImportError:
        return Response(content=html, media_type="text/html")


# ── Statistiques billing ──────────────────────────────────────────────────────

@router.get("/stats")
async def billing_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from sqlalchemy import func as sqlfunc
    devis_r = await db.execute(select(sqlfunc.count(), sqlfunc.sum(Devis.montant_ttc)).select_from(Devis))
    nb_devis, total_devis = devis_r.one()
    factures_r = await db.execute(select(sqlfunc.count(), sqlfunc.sum(Facture.montant_ttc), sqlfunc.sum(Facture.reste_a_payer)).select_from(Facture))
    nb_factures, total_factures, reste = factures_r.one()
    return {
        "nb_devis": nb_devis or 0,
        "total_devis_ttc": float(total_devis or 0),
        "nb_factures": nb_factures or 0,
        "total_factures_ttc": float(total_factures or 0),
        "reste_a_encaisser": float(reste or 0),
    }


# ── PDF builders ──────────────────────────────────────────────────────────────

_PDF_BASE_CSS = """
@page { margin: 2cm; size: A4; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0055a4; padding-bottom: 16px; margin-bottom: 20px; }
.header-left h1 { font-size: 20px; color: #0055a4; margin: 0 0 4px 0; font-weight: 700; }
.header-left p { margin: 0; color: #555; font-size: 10px; }
.header-right { text-align: right; font-size: 10px; color: #555; }
.header-right strong { font-size: 14px; color: #1a1a1a; display: block; }
.section-title { font-size: 12px; font-weight: 700; color: #0055a4; border-left: 3px solid #0055a4; padding-left: 8px; margin: 16px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.info-box { background: #f5f7fa; border-radius: 6px; padding: 10px 14px; }
.info-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #777; margin: 0 0 6px 0; }
.info-row { display: flex; gap: 8px; margin-bottom: 3px; }
.info-label { color: #888; min-width: 120px; }
.info-value { color: #1a1a1a; font-weight: 500; }
table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
thead th { background: #0055a4; color: white; padding: 6px 8px; text-align: left; font-weight: 600; }
tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
tbody tr:nth-child(even) td { background: #f5f7fa; }
.total-section { width: 280px; margin-left: auto; }
.total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
.total-row.grand { font-weight: 700; font-size: 13px; color: #0055a4; border-top: 2px solid #0055a4; padding-top: 6px; margin-top: 4px; }
.total-row.green { color: #16a34a; }
.total-row.red { color: #dc2626; font-weight: 700; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; margin-bottom: 4px; }
.badge-green { background: #dcfce7; color: #16a34a; }
.badge-orange { background: #fef3c7; color: #d97706; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }
.badge-red { background: #fee2e2; color: #dc2626; }
.footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #aaa; text-align: center; }
.mention { font-size: 9px; color: #888; margin-top: 16px; font-style: italic; }
"""


def _patient_info_html(patient: Patient | None) -> str:
    if not patient:
        return "<p>Patient inconnu</p>"
    birth = patient.birth_date.strftime("%d/%m/%Y") if patient.birth_date else "—"
    return f"""
    <div class="info-box">
      <h3>Patient</h3>
      <div class="info-row"><span class="info-label">Nom :</span><span class="info-value">{patient.last_name.upper()} {patient.first_name}</span></div>
      <div class="info-row"><span class="info-label">Date de naissance :</span><span class="info-value">{birth}</span></div>
      <div class="info-row"><span class="info-label">NIR :</span><span class="info-value">{patient.nir or "—"}</span></div>
      <div class="info-row"><span class="info-label">Mutuelle :</span><span class="info-value">{patient.mutuelle or "—"}</span></div>
      <div class="info-row"><span class="info-label">Adresse :</span><span class="info-value">{patient.address or "—"}, {patient.postal_code or ""} {patient.city or ""}</span></div>
    </div>"""


def _build_devis_html(devis: Devis, patient: Patient | None) -> str:
    from datetime import datetime as dt
    lignes = json.loads(devis.lignes_json) if devis.lignes_json else []
    lignes_rows = "".join(
        f"<tr><td>{l['designation']}</td><td style='text-align:center'>{l['quantite']}</td>"
        f"<td style='text-align:right'>{l['prix_ht']:.2f} €</td>"
        f"<td style='text-align:center'>{l['tva']:.0f}%</td>"
        f"<td style='text-align:right'>{l['prix_ht']*l['quantite']*(1+l['tva']/100):.2f} €</td></tr>"
        for l in lignes
    )
    appareils_rows = ""
    if devis.appareil_od_marque:
        prix = float(devis.appareil_od_prix_ht or 0)
        appareils_rows += (
            f"<tr><td>OD — {devis.appareil_od_marque} {devis.appareil_od_modele or ''}</td>"
            f"<td style='text-align:center'>1</td>"
            f"<td style='text-align:right'>{prix:.2f} €</td>"
            f"<td style='text-align:center'>5.5%</td>"
            f"<td style='text-align:right'>{prix*1.055:.2f} €</td></tr>"
        )
    if devis.appareil_og_marque:
        prix = float(devis.appareil_og_prix_ht or 0)
        appareils_rows += (
            f"<tr><td>OG — {devis.appareil_og_marque} {devis.appareil_og_modele or ''}</td>"
            f"<td style='text-align:center'>1</td>"
            f"<td style='text-align:right'>{prix:.2f} €</td>"
            f"<td style='text-align:center'>5.5%</td>"
            f"<td style='text-align:right'>{prix*1.055:.2f} €</td></tr>"
        )
    validite = devis.date_validite.strftime("%d/%m/%Y") if devis.date_validite else "—"
    statut_labels = {"brouillon": ("badge-orange", "Brouillon"), "envoye": ("badge-blue", "Envoyé"), "accepte": ("badge-green", "Accepté"), "refuse": ("badge-red", "Refusé")}
    badge_cls, badge_label = statut_labels.get(devis.statut, ("badge-blue", devis.statut))

    return f"""<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>{_PDF_BASE_CSS}</style></head><body>
<div class="header">
  <div class="header-left">
    <h1>AudioAssist Pro</h1>
    <p>Centre d'audioprothèse</p>
  </div>
  <div class="header-right">
    <span class="badge {badge_cls}">{badge_label}</span>
    <strong>DEVIS N° {devis.numero}</strong>
    <span>Date : {devis.date_devis.strftime('%d/%m/%Y')}</span><br>
    <span>Valable jusqu'au : {validite}</span>
  </div>
</div>

<div class="info-grid">
  {_patient_info_html(patient)}
  <div class="info-box">
    <h3>Appareillage prescrit</h3>
    {"<div class='info-row'><span class='info-label'>OD :</span><span class='info-value'>" + (devis.appareil_od_marque or "") + " " + (devis.appareil_od_modele or "") + " — Classe " + str(devis.appareil_od_classe_lpp or "—") + "</span></div>" if devis.appareil_od_marque else ""}
    {"<div class='info-row'><span class='info-label'>OG :</span><span class='info-value'>" + (devis.appareil_og_marque or "") + " " + (devis.appareil_og_modele or "") + " — Classe " + str(devis.appareil_og_classe_lpp or "—") + "</span></div>" if devis.appareil_og_marque else ""}
  </div>
</div>

<h2 class="section-title">Détail du devis</h2>
<table>
  <thead><tr><th>Désignation</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total TTC</th></tr></thead>
  <tbody>
    {appareils_rows}
    {lignes_rows}
  </tbody>
</table>

<div class="total-section">
  <div class="total-row"><span>Total HT</span><span>{float(devis.montant_total_ht or 0):.2f} €</span></div>
  <div class="total-row"><span>TVA</span><span>{float(devis.montant_tva or 0):.2f} €</span></div>
  <div class="total-row grand"><span>TOTAL TTC</span><span>{float(devis.montant_ttc or 0):.2f} €</span></div>
  <div class="total-row green"><span>Remboursement Sécu</span><span>- {float(devis.remboursement_secu or 0):.2f} €</span></div>
  <div class="total-row green"><span>Remboursement Mutuelle</span><span>- {float(devis.remboursement_mutuelle or 0):.2f} €</span></div>
  <div class="total-row red"><span>RESTE À CHARGE</span><span>{float(devis.reste_a_charge or 0):.2f} €</span></div>
</div>

{f'<p class="mention">Notes : {devis.notes}</p>' if devis.notes else ""}
<p class="mention">Devis non contractuel — Valable {validite} — Remboursements donnés à titre indicatif selon les barèmes LPP en vigueur.</p>

<div class="footer">AudioAssist Pro — Document généré le {dt.utcnow().strftime('%d/%m/%Y')}</div>
</body></html>"""


def _build_facture_html(facture: Facture, patient: Patient | None, devis: Devis | None) -> str:
    from datetime import datetime as dt
    lignes = json.loads(facture.lignes_json) if facture.lignes_json else []

    appareils_rows = ""
    if devis:
        if devis.appareil_od_marque:
            prix = float(devis.appareil_od_prix_ht or 0)
            appareils_rows += (
                f"<tr><td>OD — {devis.appareil_od_marque} {devis.appareil_od_modele or ''}"
                f"{' (Réf: ' + devis.appareil_od_reference + ')' if devis.appareil_od_reference else ''}</td>"
                f"<td style='text-align:center'>1</td>"
                f"<td style='text-align:right'>{prix:.2f} €</td>"
                f"<td style='text-align:center'>5.5%</td>"
                f"<td style='text-align:right'>{prix*1.055:.2f} €</td></tr>"
            )
        if devis.appareil_og_marque:
            prix = float(devis.appareil_og_prix_ht or 0)
            appareils_rows += (
                f"<tr><td>OG — {devis.appareil_og_marque} {devis.appareil_og_modele or ''}"
                f"{' (Réf: ' + devis.appareil_og_reference + ')' if devis.appareil_og_reference else ''}</td>"
                f"<td style='text-align:center'>1</td>"
                f"<td style='text-align:right'>{prix:.2f} €</td>"
                f"<td style='text-align:center'>5.5%</td>"
                f"<td style='text-align:right'>{prix*1.055:.2f} €</td></tr>"
            )

    lignes_rows = "".join(
        f"<tr><td>{l['designation']}</td><td style='text-align:center'>{l['quantite']}</td>"
        f"<td style='text-align:right'>{l['prix_ht']:.2f} €</td>"
        f"<td style='text-align:center'>{l['tva']:.0f}%</td>"
        f"<td style='text-align:right'>{l['prix_ht']*l['quantite']*(1+l['tva']/100):.2f} €</td></tr>"
        for l in lignes
    )

    statut_labels = {"emise": ("badge-blue", "Émise"), "payee": ("badge-green", "Payée"), "partiellement_payee": ("badge-orange", "Partiellement payée"), "annulee": ("badge-red", "Annulée")}
    badge_cls, badge_label = statut_labels.get(facture.statut, ("badge-blue", facture.statut))

    paye = float(facture.montant_paye or 0)
    reste = float(facture.reste_a_payer or 0)
    ttc = float(facture.montant_ttc or 0)

    remb_section = ""
    if devis:
        remb_s = float(devis.remboursement_secu or 0)
        remb_m = float(devis.remboursement_mutuelle or 0)
        if remb_s or remb_m:
            remb_section = f"""
  <div class="total-row green"><span>Remboursement Sécu</span><span>- {remb_s:.2f} €</span></div>
  <div class="total-row green"><span>Remboursement Mutuelle</span><span>- {remb_m:.2f} €</span></div>"""

    return f"""<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>{_PDF_BASE_CSS}</style></head><body>
<div class="header">
  <div class="header-left">
    <h1>AudioAssist Pro</h1>
    <p>Centre d'audioprothèse</p>
  </div>
  <div class="header-right">
    <span class="badge {badge_cls}">{badge_label}</span>
    <strong>FACTURE N° {facture.numero}</strong>
    <span>Date : {facture.date_facture.strftime('%d/%m/%Y')}</span>
    {f"<br><span>Devis ref. : {devis.numero}</span>" if devis else ""}
  </div>
</div>

<div class="info-grid">
  {_patient_info_html(patient)}
  <div class="info-box">
    <h3>Centre émetteur</h3>
    <div class="info-row"><span class="info-label">Établissement :</span><span class="info-value">AudioAssist Pro</span></div>
    <div class="info-row"><span class="info-label">Facture N° :</span><span class="info-value">{facture.numero}</span></div>
    <div class="info-row"><span class="info-label">Date :</span><span class="info-value">{facture.date_facture.strftime('%d/%m/%Y')}</span></div>
  </div>
</div>

<h2 class="section-title">Détail de la facture</h2>
<table>
  <thead><tr><th>Désignation</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total TTC</th></tr></thead>
  <tbody>
    {appareils_rows}
    {lignes_rows}
    {"<tr><td colspan='5' style='text-align:center;color:#aaa;font-style:italic'>Aucune ligne</td></tr>" if not appareils_rows and not lignes_rows else ""}
  </tbody>
</table>

<div class="total-section">
  <div class="total-row grand"><span>TOTAL TTC</span><span>{ttc:.2f} €</span></div>
  {remb_section}
  <div class="total-row"><span>Montant payé</span><span>{paye:.2f} €</span></div>
  <div class="total-row red"><span>RESTE À PAYER</span><span>{reste:.2f} €</span></div>
</div>

{f'<p class="mention">Notes : {facture.notes}</p>' if facture.notes else ""}
<p class="mention">Facture acquittée le règlement effectué. Merci de conserver ce document pour vos remboursements.</p>

<div class="footer">AudioAssist Pro — Facture générée le {dt.utcnow().strftime('%d/%m/%Y')}</div>
</body></html>"""
