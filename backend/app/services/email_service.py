"""
Service d'envoi d'emails avec pièces jointes pour les demandes de PEC mutuelles.
Utilise SMTP avec TLS (compatible Gmail, OVH, IONOS, Infomaniak…).
"""

import smtplib
import base64
import mimetypes
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid
from typing import Optional
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()


class EmailService:
    def __init__(self):
        self.smtp_host = getattr(settings, "SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = getattr(settings, "SMTP_PORT", 587)
        self.smtp_user = getattr(settings, "SMTP_USER", "")
        self.smtp_password = getattr(settings, "SMTP_PASSWORD", "")
        self.sender_name = getattr(settings, "SMTP_SENDER_NAME", "AudioAssist Pro")
        self.sender_email = getattr(settings, "SMTP_SENDER_EMAIL", self.smtp_user)

    def send(
        self,
        to: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        cc: Optional[str] = None,
        bcc: Optional[str] = None,
        attachments: Optional[list[dict]] = None,
        reply_to: Optional[str] = None,
    ) -> bool:
        """
        Envoie un email avec pièces jointes.
        attachments: [{"filename": "devis.pdf", "data": bytes, "mime": "application/pdf"}, …]
        """
        try:
            msg = MIMEMultipart("mixed")
            msg["From"] = f"{self.sender_name} <{self.sender_email}>"
            msg["To"] = to
            msg["Subject"] = subject
            msg["Date"] = formatdate(localtime=True)
            msg["Message-ID"] = make_msgid()

            if cc:
                msg["Cc"] = cc
            if reply_to:
                msg["Reply-To"] = reply_to

            # Corps de l'email (HTML + texte brut en fallback)
            body_part = MIMEMultipart("alternative")
            if body_text:
                body_part.attach(MIMEText(body_text, "plain", "utf-8"))
            body_part.attach(MIMEText(body_html, "html", "utf-8"))
            msg.attach(body_part)

            # Pièces jointes
            for att in attachments or []:
                data = att.get("data")
                if data is None:
                    continue
                if isinstance(data, str):
                    data = base64.b64decode(data)

                mime_type = att.get("mime", "application/octet-stream")
                main_type, sub_type = mime_type.split("/", 1)
                part = MIMEBase(main_type, sub_type)
                part.set_payload(data)
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    "attachment",
                    filename=att.get("filename", "document.pdf"),
                )
                msg.attach(part)

            # Envoi SMTP
            recipients = [to]
            if cc:
                recipients += [x.strip() for x in cc.split(",")]
            if bcc:
                recipients += [x.strip() for x in bcc.split(",")]

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.sender_email, recipients, msg.as_string())

            log.info("Email envoyé", to=to, subject=subject)
            return True

        except Exception as e:
            log.error("Erreur envoi email", to=to, error=str(e))
            return False

    def build_pec_email_body(
        self,
        mutuelle_info: dict,
        patient: dict,
        appareils: list[dict],
        auteur: dict,
        montants: dict,
        classe_lpp: int = 1,
    ) -> dict:
        """
        Génère le corps de l'email de demande de PEC.
        Retourne {"subject": str, "html": str, "text": str}.
        """
        patient_nom = f"{patient.get('last_name', '').upper()} {patient.get('first_name', '')}"
        patient_nir = patient.get("nir", "—")
        patient_naissance = patient.get("birth_date", "—")
        patient_mutuelle = patient.get("mutuelle", mutuelle_info.get("nom", "—"))
        patient_adherent = patient.get("numero_adherent_mutuelle", "—")

        auteur_nom = f"{auteur.get('first_name', '')} {auteur.get('last_name', '')}"
        auteur_rpps = auteur.get("rpps_number", "—")
        auteur_centre = auteur.get("centre", "—")

        # Lignes appareils
        appareils_html = ""
        appareils_text = ""
        for a in appareils:
            cat = a.get("catalog", {}) or {}
            label = f"{cat.get('marque', '')} {cat.get('modele', '')} — Réf. {cat.get('reference', '')} — Côté : {a.get('cote', '').capitalize()}"
            prix = a.get("prix_vente_ht", 0) or 0
            appareils_html += f"<tr><td style='padding:4px 8px'>{label}</td><td style='padding:4px 8px;text-align:right'>{prix:.2f} € HT</td></tr>"
            appareils_text += f"  • {label} — {prix:.2f} € HT\n"

        montant_demande = montants.get("montant_demande", 0) or 0
        base_remb = montants.get("base_remboursement", 0) or 0

        subject = (
            f"Demande de prise en charge audioprothèse — "
            f"{patient_nom} — N° adhérent {patient_adherent} — "
            f"{patient_mutuelle}"
        )

        html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; font-size: 11pt; color: #222; margin: 0; padding: 20px;">

<p>À l'attention du Service Prise en Charge Audioprothèse<br>
<strong>{mutuelle_info.get("nom", patient_mutuelle)}</strong><br>
{mutuelle_info.get("email_pec", "")}</p>

<p>Objet : <strong>Demande de prise en charge audioprothèse — Classe LPP {classe_lpp}</strong></p>

<hr style="border: 1px solid #ddd; margin: 16px 0;">

<p>Madame, Monsieur,</p>

<p>Je me permets de vous adresser une demande de prise en charge audioprothétique
pour le(la) patient(e) suivant(e) :</p>

<table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 12px 0;">
  <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:bold">Patient</td>
      <td style="padding:4px 8px">{patient_nom}</td></tr>
  <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:bold">Date de naissance</td>
      <td style="padding:4px 8px">{patient_naissance}</td></tr>
  <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:bold">N° Sécurité Sociale</td>
      <td style="padding:4px 8px">{patient_nir}</td></tr>
  <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:bold">Mutuelle</td>
      <td style="padding:4px 8px">{patient_mutuelle}</td></tr>
  <tr><td style="padding:4px 8px;background:#f5f5f5;font-weight:bold">N° Adhérent</td>
      <td style="padding:4px 8px">{patient_adherent}</td></tr>
</table>

<p><strong>Appareils audioprothétiques préconisés (Classe LPP {classe_lpp}) :</strong></p>
<table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 8px 0; border: 1px solid #ddd;">
  <thead><tr style="background:#1e3a8a;color:white">
    <th style="padding:6px 8px;text-align:left">Appareil</th>
    <th style="padding:6px 8px;text-align:right">Prix</th>
  </tr></thead>
  <tbody>{appareils_html}</tbody>
  <tfoot>
    <tr style="background:#f5f5f5;font-weight:bold">
      <td style="padding:6px 8px">Montant total demandé</td>
      <td style="padding:6px 8px;text-align:right">{montant_demande:.2f} €</td>
    </tr>
    {"" if not base_remb else f'<tr><td style="padding:6px 8px;font-size:9pt;color:#555">Base de remboursement LPP</td><td style="padding:6px 8px;text-align:right;font-size:9pt">{base_remb:.2f} €</td></tr>'}
  </tfoot>
</table>

<p>Vous trouverez en pièces jointes :</p>
<ul>
  <li>✅ Le devis détaillé signé</li>
  <li>✅ L'ordonnance médicale</li>
  <li>✅ La carte de mutuelle du patient</li>
</ul>

<p>Nous restons à votre disposition pour tout renseignement complémentaire.</p>

<p>Cordialement,</p>

<p style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd;">
  <strong>{auteur_nom}</strong><br>
  Audioprothésiste Diplômé(e) d'État<br>
  N° RPPS : {auteur_rpps}<br>
  Centre : {auteur_centre}<br>
  <em style="color:#555; font-size:9pt">Document généré par AudioAssist Pro</em>
</p>
</body>
</html>"""

        text = f"""Demande de prise en charge audioprothèse — Classe LPP {classe_lpp}

À l'attention du Service PEC Audioprothèse — {mutuelle_info.get("nom", patient_mutuelle)}

Madame, Monsieur,

Je me permets de vous adresser une demande de prise en charge audioprothétique pour :

  Patient : {patient_nom}
  Date de naissance : {patient_naissance}
  N° Sécurité Sociale : {patient_nir}
  Mutuelle : {patient_mutuelle}
  N° Adhérent : {patient_adherent}

Appareils préconisés (Classe LPP {classe_lpp}) :
{appareils_text}
  Montant total demandé : {montant_demande:.2f} €

Pièces jointes :
  - Devis détaillé signé
  - Ordonnance médicale
  - Carte de mutuelle

Cordialement,
{auteur_nom} — Audioprothésiste D.É. — RPPS {auteur_rpps}
{auteur_centre}
"""

        return {"subject": subject, "html": html, "text": text}


email_service = EmailService()
