"""
Service de gestion des prises en charge (PEC) mutuelles.
Orchestration : détection du réseau, génération email, suivi statuts.
"""

import uuid
from datetime import datetime
from typing import Optional
from app.core.mutuelles_database import find_mutuelle, MUTUELLES, RESEAU_LABELS
from app.services.email_service import email_service
import structlog

log = structlog.get_logger()


class PECService:

    def detect_reseau(self, mutuelle_nom: str) -> Optional[dict]:
        """Détecte automatiquement la mutuelle et son réseau depuis le nom."""
        return find_mutuelle(mutuelle_nom)

    def generate_reference(self, centre_code: str = "CTR") -> str:
        ts = datetime.utcnow().strftime("%Y%m%d")
        uid = uuid.uuid4().hex[:6].upper()
        return f"PEC-{centre_code}-{ts}-{uid}"

    def get_email_for_mutuelle(self, mutuelle_nom: str) -> Optional[str]:
        """Retourne l'email PEC pour une mutuelle donnée."""
        mutuelle = find_mutuelle(mutuelle_nom)
        if mutuelle:
            return mutuelle.get("email_pec")
        return None

    def get_portal_url(self, mutuelle_nom: str) -> Optional[str]:
        """Retourne l'URL du portail pro pour une mutuelle."""
        mutuelle = find_mutuelle(mutuelle_nom)
        if mutuelle and mutuelle.get("procedure_portail"):
            return mutuelle.get("portail_url")
        return None

    def get_required_documents(self, mutuelle_nom: str) -> list[str]:
        mutuelle = find_mutuelle(mutuelle_nom)
        if mutuelle:
            return mutuelle.get("documents_requis", ["devis", "ordonnance", "carte_mutuelle"])
        return ["devis", "ordonnance", "carte_mutuelle"]

    async def send_pec_email(
        self,
        patient: dict,
        mutuelle_info: dict,
        appareils: list[dict],
        auteur: dict,
        montants: dict,
        classe_lpp: int,
        documents: list[dict],  # [{"filename": str, "data": bytes, "mime": str, "type": str}]
        destinataire_override: Optional[str] = None,
        cc: Optional[str] = None,
    ) -> dict:
        """
        Compose et envoie l'email de demande de PEC.
        Retourne {"success": bool, "to": str, "subject": str, "message_id": str}.
        """
        to_email = destinataire_override or mutuelle_info.get("email_pec")
        if not to_email:
            return {"success": False, "error": "Adresse email de la mutuelle introuvable"}

        content = email_service.build_pec_email_body(
            mutuelle_info=mutuelle_info,
            patient=patient,
            appareils=appareils,
            auteur=auteur,
            montants=montants,
            classe_lpp=classe_lpp,
        )

        # Filtrer les documents selon ce que la mutuelle demande
        requis = mutuelle_info.get("documents_requis", [])
        attachments = []
        for doc in documents:
            doc_type = doc.get("type", "")
            if not requis or doc_type in requis:
                attachments.append({
                    "filename": doc["filename"],
                    "data": doc["data"],
                    "mime": doc.get("mime", "application/pdf"),
                })

        success = email_service.send(
            to=to_email,
            subject=content["subject"],
            body_html=content["html"],
            body_text=content["text"],
            cc=cc,
            attachments=attachments,
        )

        return {
            "success": success,
            "to": to_email,
            "subject": content["subject"],
            "email_corps": content["html"],
        }

    def list_all_mutuelles(self) -> list[dict]:
        return [
            {
                "nom": m["nom"],
                "reseau": m["reseau"],
                "reseau_label": RESEAU_LABELS.get(m["reseau"], m["reseau"]),
                "email_pec": m.get("email_pec"),
                "portail_url": m.get("portail_url"),
                "portail_label": m.get("portail_label"),
                "telephone": m.get("telephone"),
                "procedure_email": m.get("procedure_email", True),
                "procedure_portail": m.get("procedure_portail", False),
                "documents_requis": m.get("documents_requis", []),
                "delai_reponse_jours": m.get("delai_reponse_jours", 5),
                "notes": m.get("notes"),
                "couleur": m.get("couleur", "#555"),
            }
            for m in MUTUELLES
        ]

    def search_mutuelle(self, query: str) -> list[dict]:
        query_lower = query.lower()
        results = []
        for m in MUTUELLES:
            if (query_lower in m["nom"].lower() or
                    any(query_lower in a for a in m["aliases"])):
                results.append(m)
        return results[:10]


pec_service = PECService()
