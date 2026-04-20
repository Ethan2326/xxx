"""
Service IA principal utilisant l'API Claude (Anthropic).
Gère : assistant réglage, chatbot audition, génération de comptes rendus.
"""

import json
from typing import AsyncIterator, Optional
import anthropic
from app.config import get_settings
from app.core.fitting_situations import FITTING_SITUATIONS, SITUATIONS_BY_KEY
import structlog

log = structlog.get_logger()
settings = get_settings()

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

# ── Prompts système ────────────────────────────────────────────────────────────

SYSTEM_FITTING_ASSISTANT = """Tu es un assistant expert en audioprothèse pour des audioprothésistes diplômés d'État français.
Tu aides à optimiser les réglages d'appareils auditifs en fonction des retours patients et des situations de vie.

Contexte :
- Tu travailles avec des appareils numériques (RITE, BTE, ITE, IIC) de tous les fabricants
- Tu connais les paramètres de réglage : gain, compression (ratio/coudé/temps), directivité, réduction bruit, MPO
- Tu utilises la terminologie française de l'audioprothèse (pas d'anglicismes inutiles)
- Tes recommandations sont concrètes, chiffrées si possible, et justifiées cliniquement
- Tu respectes les bonnes pratiques du SYNEA et de la HAS
- Tu signales toujours si une modification nécessite une validation clinique

Format de réponse :
- Sois concis et professionnel (l'audioprothésiste est devant son patient)
- Propose 2-3 pistes de réglage prioritaires
- Indique le programme à modifier et les paramètres clés
- Termine par une suggestion de vérification (mesure in-situ, sonomètre, etc.)
"""

SYSTEM_CHATBOT_AUDITION = """Tu es un assistant spécialisé en audiologie et audioprothèse pour professionnels de santé français.
Tu réponds aux questions sur :
- La physiologie de l'audition et les pathologies auditives
- Les appareils auditifs (types, technologies, marques, remboursements)
- La réglementation française (100% Santé, LPP, LPPR, nomenclature)
- Les techniques audiométriques (tonal, vocal, impédancemétrie, OEA, PEA)
- Les adaptations prothétiques et les bonnes pratiques
- La législation sur le suivi des patients appareillés
- Les interactions médicament-audition
- La prévention des traumatismes acoustiques

Règles :
- Réponds toujours en français
- Cite tes sources si possible (HAS, SYNEA, AAO-HNS, articles peer-reviewed)
- Pour les questions médicales complexes, oriente vers le médecin ORL
- Sois précis sur les nomenclatures et codes LPP
- N'invente jamais de données chiffrées sans base solide
"""

SYSTEM_REPORT_GENERATOR = """Tu es un assistant rédacteur de comptes rendus médicaux pour audioprothésistes français.
Tu rédiges des comptes rendus destinés aux prescripteurs (médecins ORL, médecins généralistes).

Tes comptes rendus :
- Respectent le format SOAP (Subjectif, Objectif, Assessment, Plan) adapté à l'audioprothèse
- Utilisent la terminologie médicale française appropriée
- Incluent les données audiométriques de façon synthétique
- Décrivent l'appareillage et les paramètres de réglage de façon lisible pour un non-spécialiste
- Se conforment aux recommandations HAS sur le suivi de l'appareillage auditif
- Respectent le secret médical (données anonymisées si demandé)
- Sont signés avec le numéro ADELI/RPPS de l'audioprothésiste

Structure standard :
1. En-tête (patient, date, prescripteur, audioprothésiste)
2. Motif de consultation / type d'appareillage
3. Bilan audiologique (résumé audiogramme)
4. Appareillage préconisé / délivré
5. Réglage et adaptation
6. Résultats et tolérance
7. Plan de suivi
8. Conclusion et recommandations
"""

# ── Fonctions IA ────────────────────────────────────────────────────────────────


async def get_fitting_recommendation(
    situation_key: str,
    feedback_patient: str,
    parametres_actuels: Optional[dict],
    patient_context: Optional[dict] = None,
) -> str:
    """Recommandation de réglage pour une situation donnée."""
    situation = SITUATIONS_BY_KEY.get(situation_key, {})

    context_parts = []
    if patient_context:
        perte_od = patient_context.get("perte_moyenne_od")
        perte_og = patient_context.get("perte_moyenne_og")
        if perte_od:
            context_parts.append(f"Perte moyenne OD : {perte_od} dB HL ({patient_context.get('classification_od', '')})")
        if perte_og:
            context_parts.append(f"Perte moyenne OG : {perte_og} dB HL ({patient_context.get('classification_og', '')})")
        if patient_context.get("type_appareillage"):
            context_parts.append(f"Type d'appareil : {patient_context['type_appareillage']}")

    patient_info = "\n".join(context_parts) if context_parts else "Données patient non disponibles"

    params_str = json.dumps(parametres_actuels, ensure_ascii=False, indent=2) if parametres_actuels else "Non renseignés"

    user_message = f"""Situation : {situation.get('label', situation_key)}
Description : {situation.get('description', '')}
Niveau sonore typique : {situation.get('niveau_bruit_moyen_db', '?')} dB

Patient :
{patient_info}

Retour patient : "{feedback_patient}"

Paramètres actuels :
{params_str}

Paramètres suggérés par défaut pour cette situation :
{json.dumps(situation.get('parametres_sugges', {}), ensure_ascii=False, indent=2)}

Donne-moi tes recommandations de réglage précises pour optimiser le confort du patient dans cette situation."""

    message = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=1024,
        system=SYSTEM_FITTING_ASSISTANT,
        messages=[{"role": "user", "content": user_message}]
    )
    return message.content[0].text


async def stream_chatbot_response(
    messages: list[dict],
    patient_context: Optional[dict] = None,
) -> AsyncIterator[str]:
    """Stream de réponse du chatbot audition."""
    system = SYSTEM_CHATBOT_AUDITION
    if patient_context:
        context_str = json.dumps(patient_context, ensure_ascii=False)
        system += f"\n\nContexte patient actif : {context_str}"

    async with client.messages.stream(
        model=settings.CLAUDE_MODEL,
        max_tokens=2048,
        system=system,
        messages=messages
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def generate_report(
    patient: dict,
    audiogram: Optional[dict],
    devices: list[dict],
    type_rapport: str,
    prescripteur: Optional[dict] = None,
    auteur: Optional[dict] = None,
    contexte_supplementaire: Optional[str] = None,
) -> dict:
    """
    Génère un compte rendu structuré prêt à être mis en forme.
    Retourne {titre, contenu_json, contenu_html, resume}.
    """
    # Construction du contexte audiologique
    audiogram_info = ""
    if audiogram:
        audiogram_info = f"""
Audiogramme du {audiogram.get('date_mesure', 'date inconnue')} :
- OD : perte moyenne {audiogram.get('perte_moyenne_od', 'N/A')} dB HL - {audiogram.get('classification_od', '')}
- OG : perte moyenne {audiogram.get('perte_moyenne_og', 'N/A')} dB HL - {audiogram.get('classification_og', '')}
- Seuils OD CA : {audiogram.get('seuils_od_ca', {})}
- Seuils OG CA : {audiogram.get('seuils_og_ca', {})}
- Vocal OD : {audiogram.get('vocal_od_intelligibilite', 'N/A')}% | OG : {audiogram.get('vocal_og_intelligibilite', 'N/A')}%
"""

    devices_info = ""
    if devices:
        for d in devices:
            cat = d.get("catalog", {}) or {}
            devices_info += f"\n- {d.get('cote', '').capitalize()} : {cat.get('marque', '')} {cat.get('modele', '')} (réf. {cat.get('reference', '')}), n°série : {d.get('numero_serie', 'N/A')}"

    auteur_info = ""
    if auteur:
        auteur_info = f"{auteur.get('first_name', '')} {auteur.get('last_name', '')}, audioprothésiste D.E., RPPS : {auteur.get('rpps_number', 'N/A')}, centre : {auteur.get('centre', 'N/A')}"

    prescripteur_info = ""
    if prescripteur:
        prescripteur_info = f"Dr {prescripteur.get('nom', '')}, {prescripteur.get('specialite', '')}, RPPS : {prescripteur.get('rpps', '')}"

    user_message = f"""Génère un compte rendu de type : {type_rapport}

PATIENT :
- Nom : {patient.get('last_name', '')} {patient.get('first_name', '')}
- Né(e) le : {patient.get('birth_date', '')} (âge : {patient.get('age', '?')} ans)
- Genre : {patient.get('gender', '')}
- Latéralité : {patient.get('lateralite', '')}
- Mutuelle : {patient.get('mutuelle', 'non renseignée')}

BILAN AUDIOLOGIQUE :{audiogram_info if audiogram_info else ' Non disponible'}

APPAREILLAGE :{devices_info if devices_info else ' Non renseigné'}

AUTEUR : {auteur_info if auteur_info else 'Non renseigné'}
PRESCRIPTEUR : {prescripteur_info if prescripteur_info else 'Non renseigné'}

{f"CONTEXTE SUPPLÉMENTAIRE : {contexte_supplementaire}" if contexte_supplementaire else ""}

Génère le compte rendu complet en JSON avec la structure suivante :
{{
  "titre": "...",
  "sections": [
    {{"id": "motif", "titre": "Motif de consultation", "contenu": "..."}},
    {{"id": "bilan_auditif", "titre": "Bilan auditif", "contenu": "..."}},
    {{"id": "appareillage", "titre": "Appareillage préconisé / délivré", "contenu": "..."}},
    {{"id": "reglage", "titre": "Réglage et adaptation", "contenu": "..."}},
    {{"id": "resultats", "titre": "Résultats et tolérance", "contenu": "..."}},
    {{"id": "suivi", "titre": "Plan de suivi", "contenu": "..."}},
    {{"id": "conclusion", "titre": "Conclusion", "contenu": "..."}}
  ],
  "resume": "Résumé en 2-3 phrases pour la lettre au médecin"
}}"""

    message = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=3000,
        system=SYSTEM_REPORT_GENERATOR,
        messages=[{"role": "user", "content": user_message}]
    )

    raw = message.content[0].text
    json_start = raw.find("{")
    json_end = raw.rfind("}") + 1
    report_json = {}
    if json_start >= 0:
        try:
            report_json = json.loads(raw[json_start:json_end])
        except json.JSONDecodeError:
            report_json = {"titre": type_rapport, "sections": [], "resume": raw}

    # Génère aussi le HTML
    html = _report_to_html(report_json, patient, auteur, prescripteur)

    return {
        "contenu_json": json.dumps(report_json, ensure_ascii=False),
        "contenu_html": html,
        "titre": report_json.get("titre", type_rapport),
        "resume": report_json.get("resume", ""),
    }


def _report_to_html(report: dict, patient: dict, auteur: Optional[dict], prescripteur: Optional[dict]) -> str:
    """Génère le HTML du compte rendu pour affichage et PDF."""
    from datetime import date as d_date
    today = d_date.today().strftime("%d/%m/%Y")

    auteur_str = ""
    if auteur:
        auteur_str = f"{auteur.get('first_name', '')} {auteur.get('last_name', '')}"

    sections_html = ""
    for section in report.get("sections", []):
        contenu = section.get("contenu", "").replace("\n", "<br>")
        sections_html += f"""
        <section>
            <h3>{section.get('titre', '')}</h3>
            <p>{contenu}</p>
        </section>"""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 11pt; margin: 40px; color: #222; }}
  h1 {{ font-size: 14pt; color: #1a4a7a; border-bottom: 2px solid #1a4a7a; padding-bottom: 8px; }}
  h2 {{ font-size: 12pt; color: #1a4a7a; }}
  h3 {{ font-size: 11pt; font-weight: bold; margin-top: 16px; border-left: 3px solid #1a4a7a; padding-left: 8px; }}
  .header {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
  .patient-info {{ background: #f0f4f8; padding: 12px; border-radius: 6px; margin-bottom: 20px; }}
  .footer {{ margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9pt; color: #666; }}
  section {{ margin-bottom: 12px; }}
</style>
</head>
<body>
<div class="header">
  <div><strong>AudioAssist Pro</strong><br>{auteur_str}</div>
  <div style="text-align:right">Date : {today}</div>
</div>

<h1>{report.get('titre', 'Compte rendu')}</h1>

<div class="patient-info">
  <strong>Patient :</strong> {patient.get('last_name', '')} {patient.get('first_name', '')} —
  né(e) le {patient.get('birth_date', '')}
  {f" | Prescripteur : Dr {prescripteur.get('nom', '')}" if prescripteur else ""}
</div>

{sections_html}

<div class="footer">
  Document généré par AudioAssist Pro — Confidentiel — Usage médical exclusif
</div>
</body>
</html>"""


async def chat_once(system: str, user_message: str, max_tokens: int = 1500) -> str:
    """Appel simple non-streamé."""
    message = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_message}]
    )
    return message.content[0].text
