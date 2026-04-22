from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.report import Report
from app.models.patient import Patient
from app.models.audiogram import Audiogram
from app.models.device import HearingDevice
from app.schemas.report import ReportCreate, ReportRead, ReportUpdate, ReportGenerateRequest
from app.services.ai_service import generate_report
from app.api.v1.auth import get_current_user
from app.models.user import User
from uuid import UUID
import json
import io

router = APIRouter()


@router.get("", response_model=list[ReportRead])
async def list_reports(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).order_by(Report.created_at.desc()).limit(50))
    return [ReportRead.model_validate(r) for r in result.scalars().all()]


@router.post("/generate", response_model=ReportRead, status_code=201)
async def generate_ai_report(
    req: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Génère un compte rendu via l'IA et le sauvegarde."""
    # Charger le patient
    patient_result = await db.execute(select(Patient).where(Patient.id == req.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    # Charger le dernier audiogramme ou celui spécifié
    audiogram = None
    if req.audiogram_id:
        audio_result = await db.execute(select(Audiogram).where(Audiogram.id == req.audiogram_id))
        audiogram = audio_result.scalar_one_or_none()
    else:
        audio_result = await db.execute(
            select(Audiogram)
            .where(Audiogram.patient_id == req.patient_id)
            .order_by(Audiogram.date_mesure.desc())
            .limit(1)
        )
        audiogram = audio_result.scalar_one_or_none()

    # Charger les appareils
    devices_result = await db.execute(
        select(HearingDevice).where(HearingDevice.patient_id == req.patient_id)
    )
    devices = devices_result.scalars().all()

    # Préparer les dicts pour le service IA
    patient_dict = {
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "birth_date": str(patient.birth_date),
        "age": patient.age,
        "gender": patient.gender,
        "lateralite": patient.lateralite.value if patient.lateralite else None,
        "mutuelle": patient.mutuelle,
    }

    audiogram_dict = None
    if audiogram:
        audiogram_dict = {
            "date_mesure": str(audiogram.date_mesure),
            "perte_moyenne_od": audiogram.perte_moyenne_od,
            "perte_moyenne_og": audiogram.perte_moyenne_og,
            "classification_od": audiogram.classification_od,
            "classification_og": audiogram.classification_og,
            "seuils_od_ca": audiogram.seuils_od_ca,
            "seuils_og_ca": audiogram.seuils_og_ca,
            "vocal_od_intelligibilite": audiogram.vocal_od_intelligibilite,
            "vocal_og_intelligibilite": audiogram.vocal_og_intelligibilite,
        }

    devices_list = []
    for d in devices:
        device_dict = {
            "cote": d.cote.value,
            "statut": d.statut.value,
            "numero_serie": d.numero_serie,
        }
        if d.catalog:
            device_dict["catalog"] = {
                "marque": d.catalog.marque,
                "modele": d.catalog.modele,
                "reference": d.catalog.reference,
            }
        devices_list.append(device_dict)

    auteur_dict = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "rpps_number": current_user.rpps_number,
        "centre": current_user.centre,
    }

    prescripteur_dict = None
    if req.prescripteur_nom:
        prescripteur_dict = {
            "nom": req.prescripteur_nom,
            "specialite": req.prescripteur_specialite or "Médecin",
        }

    # Appel IA
    result = await generate_report(
        patient=patient_dict,
        audiogram=audiogram_dict,
        devices=devices_list,
        type_rapport=req.type.value,
        prescripteur=prescripteur_dict,
        auteur=auteur_dict,
        contexte_supplementaire=req.contexte_supplementaire,
    )

    # Créer l'entrée en base
    report = Report(
        patient_id=req.patient_id,
        author_id=current_user.id,
        audiogram_id=audiogram.id if audiogram else None,
        type=req.type,
        titre=result["titre"],
        prescripteur_nom=req.prescripteur_nom,
        prescripteur_specialite=req.prescripteur_specialite,
        contenu_json=result["contenu_json"],
        contenu_html=result["contenu_html"],
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return ReportRead.model_validate(report)


@router.get("/{report_id}", response_model=ReportRead)
async def get_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")
    return ReportRead.model_validate(report)


@router.get("/{report_id}/html", response_class=HTMLResponse)
async def get_report_html(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")
    return HTMLResponse(content=report.contenu_html or "<p>Aucun contenu</p>")


@router.patch("/{report_id}", response_model=ReportRead)
async def update_report(
    report_id: UUID,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")
    for field, value in report_in.model_dump(exclude_none=True).items():
        setattr(report, field, value)
    await db.flush()
    await db.refresh(report)
    return ReportRead.model_validate(report)


@router.get("/patient/{patient_id}", response_model=list[ReportRead])
async def get_patient_reports(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Report)
        .where(Report.patient_id == patient_id)
        .order_by(Report.created_at.desc())
    )
    return [ReportRead.model_validate(r) for r in result.scalars().all()]


def _build_report_html(report: Report, patient: Patient, audiogram: Audiogram | None, devices: list) -> str:
    from datetime import datetime

    freqs = ["250", "500", "1000", "2000", "3000", "4000", "6000", "8000"]

    def seuils_row(seuils: dict | None) -> str:
        if not seuils:
            return "".join("<td>—</td>" for _ in freqs)
        return "".join(f"<td>{seuils.get(f, '—')}</td>" for f in freqs)

    audiogram_section = ""
    if audiogram:
        perte_od = getattr(audiogram, "perte_moyenne_od", None)
        perte_og = getattr(audiogram, "perte_moyenne_og", None)
        classif_od = getattr(audiogram, "classification_od", "—")
        classif_og = getattr(audiogram, "classification_og", "—")
        audiogram_section = f"""
        <h2 class="section-title">Résultats audiométriques</h2>
        <p class="meta">Bilan du {audiogram.date_mesure.strftime('%d/%m/%Y')}</p>
        <table class="audio-table">
          <thead>
            <tr>
              <th>Oreille</th>
              {"".join(f"<th>{f} Hz</th>" for f in freqs)}
              <th>Perte moy.</th>
              <th>Classification</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="ear-label od">OD</td>
              {seuils_row(audiogram.seuils_od_ca)}
              <td>{f"{perte_od:.1f} dB" if perte_od else "—"}</td>
              <td>{classif_od}</td>
            </tr>
            <tr>
              <td class="ear-label og">OG</td>
              {seuils_row(audiogram.seuils_og_ca)}
              <td>{f"{perte_og:.1f} dB" if perte_og else "—"}</td>
              <td>{classif_og}</td>
            </tr>
          </tbody>
        </table>
        {"<p class='meta'>Conduction aérienne (dB HL)</p>" if audiogram.seuils_od_ca or audiogram.seuils_og_ca else ""}
        """

    devices_rows = ""
    for d in devices:
        if d.catalog:
            marque = d.catalog.marque
            modele = d.catalog.modele
            ref = d.catalog.reference
            classe = d.catalog.classe_lpp or "—"
        else:
            marque = modele = ref = classe = "—"
        cote = {"droit": "OD", "gauche": "OG", "bilateral": "Bilat."}.get(d.cote.value if hasattr(d.cote, "value") else d.cote, d.cote)
        statut = d.statut.value if hasattr(d.statut, "value") else d.statut
        prix = f"{d.prix_vente_ht:.2f} €" if d.prix_vente_ht else "—"
        devices_rows += f"<tr><td>{cote}</td><td>{marque}</td><td>{modele}</td><td>{ref}</td><td>Classe {classe}</td><td>{prix}</td><td>{statut}</td></tr>"

    devices_section = ""
    if devices_rows:
        devices_section = f"""
        <h2 class="section-title">Appareils prescrits / livrés</h2>
        <table class="data-table">
          <thead>
            <tr><th>Côté</th><th>Marque</th><th>Modèle</th><th>Référence</th><th>Classe LPP</th><th>Prix HT</th><th>Statut</th></tr>
          </thead>
          <tbody>{devices_rows}</tbody>
        </table>
        """

    nir = patient.nir or "—"
    birth = patient.birth_date.strftime("%d/%m/%Y") if patient.birth_date else "—"
    date_redaction = report.date_redaction.strftime("%d/%m/%Y") if report.date_redaction else datetime.utcnow().strftime("%d/%m/%Y")
    prescripteur_nom = report.prescripteur_nom or "—"
    prescripteur_rpps = report.prescripteur_rpps or "—"
    prescripteur_spec = report.prescripteur_specialite or "—"
    contenu_html = report.contenu_html or "<p>Aucun contenu disponible.</p>"

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    @page {{ margin: 2cm; size: A4; }}
    body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }}
    .header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0055a4; padding-bottom: 16px; margin-bottom: 20px; }}
    .header-left h1 {{ font-size: 20px; color: #0055a4; margin: 0 0 4px 0; font-weight: 700; }}
    .header-left p {{ margin: 0; color: #555; font-size: 10px; }}
    .header-right {{ text-align: right; font-size: 10px; color: #555; }}
    .header-right strong {{ font-size: 13px; color: #1a1a1a; display: block; margin-bottom: 2px; }}
    .section-title {{ font-size: 12px; font-weight: 700; color: #0055a4; border-left: 3px solid #0055a4; padding-left: 8px; margin: 18px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }}
    .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }}
    .info-box {{ background: #f5f7fa; border-radius: 6px; padding: 10px 14px; }}
    .info-box h3 {{ font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #777; margin: 0 0 6px 0; }}
    .info-row {{ display: flex; gap: 8px; margin-bottom: 3px; font-size: 11px; }}
    .info-label {{ color: #888; min-width: 90px; }}
    .info-value {{ color: #1a1a1a; font-weight: 500; }}
    .audio-table, .data-table {{ width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }}
    .audio-table th, .data-table th {{ background: #0055a4; color: white; padding: 5px 6px; text-align: center; font-weight: 600; }}
    .audio-table td, .data-table td {{ padding: 4px 6px; text-align: center; border-bottom: 1px solid #e5e7eb; }}
    .audio-table tr:nth-child(even) td {{ background: #f5f7fa; }}
    .ear-label {{ font-weight: 700; text-align: left !important; }}
    .ear-label.od {{ color: #1d4ed8; }}
    .ear-label.og {{ color: #be185d; }}
    .meta {{ font-size: 10px; color: #888; margin: 0 0 8px 0; }}
    .content-section {{ border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; margin: 12px 0; background: white; }}
    .signature-section {{ display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px; }}
    .sig-box {{ text-align: center; }}
    .sig-box p {{ font-size: 10px; color: #888; margin: 0 0 40px 0; }}
    .sig-box .sig-line {{ border-top: 1px solid #333; padding-top: 6px; font-size: 10px; color: #555; }}
    .footer {{ margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #aaa; text-align: center; }}
    .badge {{ display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 600; }}
    .badge-blue {{ background: #dbeafe; color: #1d4ed8; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>AudioAssist Pro</h1>
      <p>Centre d'audioprothèse</p>
      <p>Compte Rendu — {report.titre}</p>
    </div>
    <div class="header-right">
      <strong>Date : {date_redaction}</strong>
      <span class="badge badge-blue">{report.type.replace("_", " ").title() if report.type else ""}</span>
    </div>
  </div>

  <h2 class="section-title">Identité du patient</h2>
  <div class="info-grid">
    <div class="info-box">
      <h3>Patient</h3>
      <div class="info-row"><span class="info-label">Nom :</span><span class="info-value">{patient.last_name.upper()} {patient.first_name}</span></div>
      <div class="info-row"><span class="info-label">Date de naissance :</span><span class="info-value">{birth}</span></div>
      <div class="info-row"><span class="info-label">NIR :</span><span class="info-value">{nir}</span></div>
      <div class="info-row"><span class="info-label">Mutuelle :</span><span class="info-value">{patient.mutuelle or "—"}</span></div>
    </div>
    <div class="info-box">
      <h3>Prescripteur</h3>
      <div class="info-row"><span class="info-label">Nom :</span><span class="info-value">{prescripteur_nom}</span></div>
      <div class="info-row"><span class="info-label">RPPS :</span><span class="info-value">{prescripteur_rpps}</span></div>
      <div class="info-row"><span class="info-label">Spécialité :</span><span class="info-value">{prescripteur_spec}</span></div>
    </div>
  </div>

  {audiogram_section}
  {devices_section}

  <h2 class="section-title">Contenu du compte rendu</h2>
  <div class="content-section">
    {contenu_html}
  </div>

  <div class="signature-section">
    <div class="sig-box">
      <p>Signature du prescripteur</p>
      <div class="sig-line">{prescripteur_nom}</div>
    </div>
    <div class="sig-box">
      <p>Signature et cachet de l'audioprothésiste</p>
      <div class="sig-line">AudioAssist Pro</div>
    </div>
  </div>

  <div class="footer">
    Document généré par AudioAssist Pro — Confidentiel — Usage médical uniquement
  </div>
</body>
</html>"""


@router.get("/{report_id}/pdf")
async def get_report_pdf(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Génère et retourne un PDF du compte rendu."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Compte rendu non trouvé")

    patient_result = await db.execute(select(Patient).where(Patient.id == report.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    audiogram = None
    if report.audiogram_id:
        audio_result = await db.execute(select(Audiogram).where(Audiogram.id == report.audiogram_id))
        audiogram = audio_result.scalar_one_or_none()

    devices_result = await db.execute(
        select(HearingDevice).where(HearingDevice.patient_id == report.patient_id)
    )
    devices = devices_result.scalars().all()

    html_content = _build_report_html(report, patient, audiogram, list(devices))

    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
    except ImportError:
        # Fallback: return HTML as text if weasyprint not available
        return Response(
            content=html_content,
            media_type="text/html",
        )

    filename = f"CR_{patient.last_name}_{patient.first_name}_{report.date_redaction.strftime('%Y%m%d') if report.date_redaction else 'NA'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
