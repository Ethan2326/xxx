import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from app.database import get_db
from app.models.pec import PriseEnCharge, DocumentPEC, StatutPEC
from app.models.patient import Patient
from app.models.device import HearingDevice
from app.models.user import User
from app.schemas.pec import (
    PECCreate, PECRead, PECUpdate, PECSendEmailRequest,
    DocumentPECCreate, DocumentPECRead, MutuelleInfo
)
from app.services.pec_service import pec_service
from app.api.v1.auth import get_current_user
import structlog

log = structlog.get_logger()
router = APIRouter()


# ── Mutuelles ─────────────────────────────────────────────────────────────────

@router.get("/mutuelles", response_model=list[MutuelleInfo])
async def list_mutuelles(
    search: Optional[str] = Query(None),
    _: User = Depends(get_current_user),
):
    """Liste toutes les mutuelles connues avec leurs infos PEC."""
    if search:
        results = pec_service.search_mutuelle(search)
        all_m = pec_service.list_all_mutuelles()
        return [m for m in all_m if m["nom"] in [r["nom"] for r in results]]
    return pec_service.list_all_mutuelles()


@router.get("/mutuelles/detect")
async def detect_mutuelle(
    nom: str = Query(..., description="Nom de la mutuelle du patient"),
    _: User = Depends(get_current_user),
):
    """Détecte automatiquement la mutuelle et retourne ses infos PEC."""
    info = pec_service.detect_reseau(nom)
    if not info:
        raise HTTPException(status_code=404, detail=f"Mutuelle '{nom}' non reconnue")
    return info


# ── PEC CRUD ──────────────────────────────────────────────────────────────────

@router.get("/patient/{patient_id}", response_model=list[PECRead])
async def get_patient_pec(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PriseEnCharge)
        .where(PriseEnCharge.patient_id == patient_id)
        .order_by(PriseEnCharge.created_at.desc())
    )
    pecs = result.scalars().all()
    return [PECRead.model_validate(p) for p in pecs]


@router.post("", response_model=PECRead, status_code=201)
async def create_pec(
    pec_in: PECCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Auto-détecter le réseau
    mutuelle_info = pec_service.detect_reseau(pec_in.mutuelle_nom)
    reseau = mutuelle_info["reseau"] if mutuelle_info else None
    email_auto = mutuelle_info.get("email_pec") if mutuelle_info else None

    # Récupérer le n° adhérent du patient si non fourni
    numero_adherent = pec_in.numero_adherent
    if not numero_adherent:
        patient_result = await db.execute(select(Patient).where(Patient.id == pec_in.patient_id))
        patient = patient_result.scalar_one_or_none()
        if patient:
            numero_adherent = patient.numero_adherent_mutuelle

    centre_code = (current_user.centre or "CTR")[:3].upper()
    reference = pec_service.generate_reference(centre_code)

    pec = PriseEnCharge(
        patient_id=pec_in.patient_id,
        author_id=current_user.id,
        mutuelle_nom=pec_in.mutuelle_nom,
        reseau_tiers_payant=reseau,
        numero_adherent=numero_adherent,
        type_demande=pec_in.type_demande,
        methode=pec_in.methode,
        statut=StatutPEC.BROUILLON,
        classe_lpp=pec_in.classe_lpp,
        appareil_od_reference=pec_in.appareil_od_reference,
        appareil_og_reference=pec_in.appareil_og_reference,
        montant_demande_od=pec_in.montant_demande_od,
        montant_demande_og=pec_in.montant_demande_og,
        base_remboursement=pec_in.base_remboursement,
        email_destinataire=pec_in.email_destinataire or email_auto,
        reference_pec=reference,
        notes=pec_in.notes,
    )
    db.add(pec)
    await db.flush()
    await db.refresh(pec)
    return PECRead.model_validate(pec)


@router.get("/{pec_id}", response_model=PECRead)
async def get_pec(
    pec_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(PriseEnCharge).where(PriseEnCharge.id == pec_id))
    pec = result.scalar_one_or_none()
    if not pec:
        raise HTTPException(status_code=404, detail="PEC introuvable")
    return PECRead.model_validate(pec)


@router.patch("/{pec_id}", response_model=PECRead)
async def update_pec(
    pec_id: UUID,
    pec_in: PECUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(PriseEnCharge).where(PriseEnCharge.id == pec_id))
    pec = result.scalar_one_or_none()
    if not pec:
        raise HTTPException(status_code=404, detail="PEC introuvable")
    update_data = pec_in.model_dump(exclude_none=True)
    if "statut" in update_data and update_data["statut"] in (
        StatutPEC.ACCORDEE, StatutPEC.ACCORDEE_PARTIELLE, StatutPEC.REFUSEE
    ):
        update_data.setdefault("date_reponse", datetime.utcnow())
    for field, value in update_data.items():
        setattr(pec, field, value)
    await db.flush()
    await db.refresh(pec)
    return PECRead.model_validate(pec)


@router.delete("/{pec_id}", status_code=204)
async def delete_pec(
    pec_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(PriseEnCharge).where(PriseEnCharge.id == pec_id))
    pec = result.scalar_one_or_none()
    if not pec:
        raise HTTPException(status_code=404, detail="PEC introuvable")
    await db.delete(pec)


# ── Documents ─────────────────────────────────────────────────────────────────

@router.post("/{pec_id}/documents", response_model=DocumentPECRead, status_code=201)
async def upload_document(
    pec_id: UUID,
    file: UploadFile = File(...),
    type_document: str = Form(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(PriseEnCharge).where(PriseEnCharge.id == pec_id))
    pec = result.scalar_one_or_none()
    if not pec:
        raise HTTPException(status_code=404, detail="PEC introuvable")

    contents = await file.read()
    doc = DocumentPEC(
        pec_id=pec_id,
        patient_id=pec.patient_id,
        type_document=type_document,
        nom_fichier=file.filename or "document.pdf",
        mime_type=file.content_type or "application/pdf",
        taille_octets=len(contents),
        contenu=base64.b64encode(contents).decode("utf-8"),
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return DocumentPECRead.model_validate(doc)


@router.delete("/{pec_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    pec_id: UUID,
    doc_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DocumentPEC).where(DocumentPEC.id == doc_id, DocumentPEC.pec_id == pec_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document introuvable")
    await db.delete(doc)


# ── Envoi email PEC ───────────────────────────────────────────────────────────

@router.post("/{pec_id}/send-email")
async def send_pec_email(
    pec_id: UUID,
    req: PECSendEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Envoie la demande de PEC par email à la mutuelle avec les pièces jointes.
    Les documents peuvent être uploadés via /documents en amont OU fournis directement
    dans req.documents (base64).
    """
    pec_result = await db.execute(select(PriseEnCharge).where(PriseEnCharge.id == pec_id))
    pec = pec_result.scalar_one_or_none()
    if not pec:
        raise HTTPException(status_code=404, detail="PEC introuvable")

    patient_result = await db.execute(select(Patient).where(Patient.id == pec.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")

    devices_result = await db.execute(
        select(HearingDevice).where(HearingDevice.patient_id == pec.patient_id)
    )
    devices = devices_result.scalars().all()

    # Récupérer les documents déjà uploadés en base
    docs_result = await db.execute(
        select(DocumentPEC).where(DocumentPEC.pec_id == pec_id)
    )
    stored_docs = docs_result.scalars().all()

    # Construire la liste d'attachements
    attachments = []
    for doc in stored_docs:
        if doc.contenu:
            attachments.append({
                "filename": doc.nom_fichier,
                "data": base64.b64decode(doc.contenu),
                "mime": doc.mime_type,
                "type": doc.type_document,
            })

    # Ajouter les documents fournis dans la requête (base64)
    for doc_in in req.documents:
        if doc_in.contenu:
            attachments.append({
                "filename": doc_in.nom_fichier,
                "data": base64.b64decode(doc_in.contenu),
                "mime": doc_in.mime_type,
                "type": doc_in.type_document,
            })

    # Infos mutuelle
    mutuelle_info = pec_service.detect_reseau(pec.mutuelle_nom) or {
        "nom": pec.mutuelle_nom,
        "email_pec": pec.email_destinataire,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
    }

    patient_dict = {
        "last_name": patient.last_name,
        "first_name": patient.first_name,
        "birth_date": str(patient.birth_date),
        "nir": patient.nir,
        "mutuelle": patient.mutuelle or pec.mutuelle_nom,
        "numero_adherent_mutuelle": patient.numero_adherent_mutuelle or pec.numero_adherent,
    }

    auteur_dict = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "rpps_number": current_user.rpps_number,
        "centre": current_user.centre,
    }

    appareils_list = []
    for d in devices:
        device_dict = {"cote": d.cote.value, "prix_vente_ht": d.prix_vente_ht}
        if d.catalog:
            device_dict["catalog"] = {
                "marque": d.catalog.marque,
                "modele": d.catalog.modele,
                "reference": d.catalog.reference,
            }
        appareils_list.append(device_dict)

    montants = {
        "montant_demande": (pec.montant_demande_od or 0) + (pec.montant_demande_og or 0),
        "base_remboursement": pec.base_remboursement or 0,
    }

    result = await pec_service.send_pec_email(
        patient=patient_dict,
        mutuelle_info=mutuelle_info,
        appareils=appareils_list,
        auteur=auteur_dict,
        montants=montants,
        classe_lpp=pec.classe_lpp or 1,
        documents=attachments,
        destinataire_override=req.email_destinataire,
        cc=req.email_cc,
    )

    if result["success"]:
        pec.statut = StatutPEC.EN_ATTENTE
        pec.email_envoye_at = datetime.utcnow()
        pec.email_destinataire = result["to"]
        pec.email_objet = result["subject"]
        pec.email_corps = result.get("email_corps", "")
        pec.date_demande = datetime.utcnow()
        await db.flush()
        await db.refresh(pec)
        return {"success": True, "to": result["to"], "subject": result["subject"], "pec": PECRead.model_validate(pec)}
    else:
        raise HTTPException(status_code=500, detail=result.get("error", "Erreur d'envoi email"))


@router.get("/{pec_id}/email-preview")
async def preview_pec_email(
    pec_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Prévisualise le corps de l'email sans l'envoyer."""
    pec_result = await db.execute(select(PriseEnCharge).where(PriseEnCharge.id == pec_id))
    pec = pec_result.scalar_one_or_none()
    if not pec:
        raise HTTPException(status_code=404, detail="PEC introuvable")

    patient_result = await db.execute(select(Patient).where(Patient.id == pec.patient_id))
    patient = patient_result.scalar_one_or_none()

    devices_result = await db.execute(
        select(HearingDevice).where(HearingDevice.patient_id == pec.patient_id)
    )
    devices = devices_result.scalars().all()

    mutuelle_info = pec_service.detect_reseau(pec.mutuelle_nom) or {
        "nom": pec.mutuelle_nom,
        "email_pec": pec.email_destinataire,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
    }

    from app.services.email_service import email_service as es
    appareils_list = [
        {
            "cote": d.cote.value,
            "prix_vente_ht": d.prix_vente_ht,
            "catalog": {"marque": d.catalog.marque, "modele": d.catalog.modele, "reference": d.catalog.reference} if d.catalog else {},
        }
        for d in devices
    ]

    content = es.build_pec_email_body(
        mutuelle_info=mutuelle_info,
        patient={
            "last_name": patient.last_name if patient else "",
            "first_name": patient.first_name if patient else "",
            "birth_date": str(patient.birth_date) if patient else "",
            "nir": patient.nir if patient else "",
            "mutuelle": patient.mutuelle if patient else pec.mutuelle_nom,
            "numero_adherent_mutuelle": patient.numero_adherent_mutuelle if patient else pec.numero_adherent,
        },
        appareils=appareils_list,
        auteur={
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "rpps_number": current_user.rpps_number,
            "centre": current_user.centre,
        },
        montants={
            "montant_demande": (pec.montant_demande_od or 0) + (pec.montant_demande_og or 0),
            "base_remboursement": pec.base_remboursement or 0,
        },
        classe_lpp=pec.classe_lpp or 1,
    )

    docs_result = await db.execute(select(DocumentPEC).where(DocumentPEC.pec_id == pec_id))
    docs = docs_result.scalars().all()

    return {
        "to": pec.email_destinataire or mutuelle_info.get("email_pec"),
        "subject": content["subject"],
        "html": content["html"],
        "text": content["text"],
        "mutuelle_info": mutuelle_info,
        "documents_joints": [{"nom": d.nom_fichier, "type": d.type_document} for d in docs],
        "documents_requis": mutuelle_info.get("documents_requis", []),
    }
