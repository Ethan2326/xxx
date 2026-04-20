"""
Base de données des mutuelles et réseaux de tiers-payant français pour l'audioprothèse.
Sources : sites officiels des réseaux, UNOCAM, documentation professionnelle SYNEA.

Structure par réseau gestionnaire (Almerys, Viamedis, Santeclair…),
puis par mutuelle adhérente.
"""

from typing import Optional

# ─── Entrée de mutuelle ───────────────────────────────────────────────────────

MUTUELLES: list[dict] = [

    # ═══════════════════════════════════════════════════════════════════════
    # RÉSEAU ALMERYS
    # Portail pro : https://professional.almerys.com
    # ═══════════════════════════════════════════════════════════════════════
    {
        "nom": "Almerys (réseau gestionnaire)",
        "aliases": ["almerys"],
        "reseau": "almerys",
        "portail_url": "https://professional.almerys.com",
        "portail_label": "Portail Almerys Professionnel",
        "email_pec": "audioprothesistes@almerys.com",
        "email_pec_cc": None,
        "telephone": "04 73 28 71 82",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "Portail pro disponible 24h/24. Réponse en temps réel possible.",
        "couleur": "#e65c00",
    },
    {
        "nom": "MGC Mutuelle",
        "aliases": ["mgc", "mgc mutuelle"],
        "reseau": "almerys",
        "portail_url": "https://professional.almerys.com",
        "portail_label": "Portail Almerys",
        "email_pec": "pec.audio@mgcmutuelle.fr",
        "telephone": "01 53 45 20 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "MGC passe par Almerys pour le tiers payant.",
        "couleur": "#e65c00",
    },
    {
        "nom": "Mutuelle Bleue",
        "aliases": ["mutuelle bleue"],
        "reseau": "almerys",
        "portail_url": "https://professional.almerys.com",
        "portail_label": "Portail Almerys",
        "email_pec": "pec@mutuellebleue.fr",
        "telephone": "01 45 09 39 39",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#e65c00",
    },
    {
        "nom": "Mutuelle Nationale Territoriale (MNT)",
        "aliases": ["mnt", "mnt mutuelle"],
        "reseau": "almerys",
        "portail_url": "https://professional.almerys.com",
        "portail_label": "Portail Almerys",
        "email_pec": "priseencharge.audio@mnt.fr",
        "telephone": "01 53 32 50 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle", "audiogramme"],
        "couleur": "#e65c00",
    },
    {
        "nom": "MGEN",
        "aliases": ["mgen"],
        "reseau": "almerys",
        "portail_url": "https://professional.almerys.com",
        "portail_label": "Portail Almerys",
        "email_pec": "pec.audioprothese@mgen.fr",
        "telephone": "01 40 47 20 20",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "MGEN : remboursement spécifique enseignants. Joindre attestation de droits.",
        "couleur": "#e65c00",
    },
    {
        "nom": "Mutuelle Générale",
        "aliases": ["mutuelle générale", "la mutuelle generale"],
        "reseau": "almerys",
        "portail_url": "https://professional.almerys.com",
        "portail_label": "Portail Almerys",
        "email_pec": "pec@mutuellegenerale.fr",
        "telephone": "0970 809 809",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#e65c00",
    },

    # ═══════════════════════════════════════════════════════════════════════
    # RÉSEAU VIAMEDIS
    # Portail pro : https://www.viamedis.fr/professionnel
    # ═══════════════════════════════════════════════════════════════════════
    {
        "nom": "Viamedis (réseau gestionnaire)",
        "aliases": ["viamedis"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis Professionnel",
        "email_pec": "audioprothesistes@viamedis.fr",
        "telephone": "01 70 37 97 97",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 2,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "Viamedis gère plus de 40 mutuelles. Connexion par carte CPS recommandée.",
        "couleur": "#0066cc",
    },
    {
        "nom": "Harmonie Mutuelle",
        "aliases": ["harmonie mutuelle", "harmonie"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis",
        "email_pec": "pec.audio@harmonie-mutuelle.fr",
        "telephone": "01 56 26 80 80",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "1ère mutuelle française. Remboursements 100% Santé classe 1 et classe 2.",
        "couleur": "#0066cc",
    },
    {
        "nom": "Malakoff Humanis",
        "aliases": ["malakoff humanis", "malakoff", "humanis"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis",
        "email_pec": "pec.audioprothese@malakoffhumanis.com",
        "telephone": "01 40 68 25 25",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#0066cc",
    },
    {
        "nom": "AG2R La Mondiale",
        "aliases": ["ag2r", "ag2r la mondiale", "ag2r lamondiale"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis",
        "email_pec": "audio.pec@ag2rlamondiale.fr",
        "telephone": "09 77 40 58 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#0066cc",
    },
    {
        "nom": "April Santé",
        "aliases": ["april santé", "april"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis",
        "email_pec": "pec@april-sante.fr",
        "telephone": "04 78 38 60 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#0066cc",
    },
    {
        "nom": "Groupama Santé",
        "aliases": ["groupama", "groupama santé"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis",
        "email_pec": "pec.sante@groupama.com",
        "telephone": "0970 809 810",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#0066cc",
    },
    {
        "nom": "MMA Santé",
        "aliases": ["mma", "mma santé"],
        "reseau": "viamedis",
        "portail_url": "https://www.viamedis.fr/professionnel",
        "portail_label": "Portail Viamedis",
        "email_pec": "pec.audio@mma.fr",
        "telephone": "02 43 41 72 72",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#0066cc",
    },

    # ═══════════════════════════════════════════════════════════════════════
    # RÉSEAU SANTECLAIR
    # Portail pro : https://www.santeclair.fr/professionnel
    # ═══════════════════════════════════════════════════════════════════════
    {
        "nom": "Santeclair (réseau gestionnaire)",
        "aliases": ["santeclair"],
        "reseau": "santeclair",
        "portail_url": "https://www.santeclair.fr/professionnel",
        "portail_label": "Portail Santeclair Pro",
        "email_pec": "pro.audioprothese@santeclair.fr",
        "telephone": "0 800 200 240",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 2,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "Réseau sélectif. Vérifier que le centre est partenaire Santeclair avant la PEC.",
        "couleur": "#00a651",
    },
    {
        "nom": "Axa Santé",
        "aliases": ["axa", "axa santé", "axa assurance"],
        "reseau": "santeclair",
        "portail_url": "https://www.santeclair.fr/professionnel",
        "portail_label": "Portail Santeclair",
        "email_pec": "pec.audioprothese@axa.fr",
        "telephone": "0 800 200 200",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "AXA passe par Santeclair pour le réseau audioprothésiste.",
        "couleur": "#00a651",
    },
    {
        "nom": "Allianz Santé",
        "aliases": ["allianz", "allianz santé"],
        "reseau": "santeclair",
        "portail_url": "https://www.santeclair.fr/professionnel",
        "portail_label": "Portail Santeclair",
        "email_pec": "pec.sante@allianz.fr",
        "telephone": "01 58 85 20 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#00a651",
    },
    {
        "nom": "Generali Santé",
        "aliases": ["generali", "generali santé"],
        "reseau": "santeclair",
        "portail_url": "https://www.santeclair.fr/professionnel",
        "portail_label": "Portail Santeclair",
        "email_pec": "pec.audioprothese@generali.fr",
        "telephone": "01 58 38 70 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#00a651",
    },
    {
        "nom": "Swiss Life",
        "aliases": ["swiss life", "swisslife"],
        "reseau": "santeclair",
        "portail_url": "https://www.santeclair.fr/professionnel",
        "portail_label": "Portail Santeclair",
        "email_pec": "pec.sante@swisslife.fr",
        "telephone": "01 73 02 80 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#00a651",
    },

    # ═══════════════════════════════════════════════════════════════════════
    # RÉSEAU OXANTIS
    # Portail pro : https://www.oxantis.com
    # ═══════════════════════════════════════════════════════════════════════
    {
        "nom": "Oxantis (réseau gestionnaire)",
        "aliases": ["oxantis"],
        "reseau": "oxantis",
        "portail_url": "https://www.oxantis.com/professionnel-sante",
        "portail_label": "Portail Oxantis Pro",
        "email_pec": "audioprothesistes@oxantis.com",
        "telephone": "01 40 96 00 40",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "Réseau géré par Klesia et quelques mutuelles de prévoyance.",
        "couleur": "#9b1d84",
    },
    {
        "nom": "Klesia",
        "aliases": ["klesia"],
        "reseau": "oxantis",
        "portail_url": "https://www.oxantis.com/professionnel-sante",
        "portail_label": "Portail Oxantis",
        "email_pec": "pec.audio@klesia.fr",
        "telephone": "01 44 62 20 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#9b1d84",
    },

    # ═══════════════════════════════════════════════════════════════════════
    # RÉSEAU SÉVEANE
    # Portail pro : https://www.seveane.fr
    # ═══════════════════════════════════════════════════════════════════════
    {
        "nom": "Séveane (réseau gestionnaire)",
        "aliases": ["seveane", "séveane"],
        "reseau": "seveane",
        "portail_url": "https://www.seveane.fr/professionnel",
        "portail_label": "Portail Séveane Pro",
        "email_pec": "audioprothesistes@seveane.fr",
        "telephone": "09 77 40 01 35",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 3,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "Réseau Séveane = ex-réseau Audiens principalement.",
        "couleur": "#e4002b",
    },
    {
        "nom": "Audiens",
        "aliases": ["audiens"],
        "reseau": "seveane",
        "portail_url": "https://www.seveane.fr/professionnel",
        "portail_label": "Portail Séveane",
        "email_pec": "pec.audioprothese@audiens.org",
        "telephone": "01 44 89 64 00",
        "procedure_portail": True,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "notes": "Mutuelle des intermittents du spectacle et de l'audiovisuel.",
        "couleur": "#e4002b",
    },

    # ═══════════════════════════════════════════════════════════════════════
    # MUTUELLES EN DIRECT (sans réseau tiers-payant spécifique)
    # ═══════════════════════════════════════════════════════════════════════
    {
        "nom": "MAIF",
        "aliases": ["maif"],
        "reseau": "direct",
        "portail_url": "https://www.maif.fr/espace-adherent",
        "portail_label": "Espace adhérent MAIF",
        "email_pec": "pec.sante@maif.fr",
        "telephone": "05 49 73 73 73",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#333333",
    },
    {
        "nom": "MACIF",
        "aliases": ["macif"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.audioprothese@macif.fr",
        "telephone": "09 74 50 20 20",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#e2001a",
    },
    {
        "nom": "MATMUT",
        "aliases": ["matmut"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.sante@matmut.fr",
        "telephone": "02 35 03 67 89",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#005ea8",
    },
    {
        "nom": "MAAF",
        "aliases": ["maaf"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.sante@maaf.fr",
        "telephone": "09 70 82 20 20",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#e4002b",
    },
    {
        "nom": "Mutuelle des Motards (AREAS)",
        "aliases": ["areas", "mutuelle des motards"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec@areas.fr",
        "telephone": "01 44 76 22 22",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#333333",
    },
    {
        "nom": "Mutex (CCN Syntec)",
        "aliases": ["mutex"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.sante@mutex.fr",
        "telephone": "01 40 47 67 83",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#333333",
    },
    {
        "nom": "OCIANE Matmut",
        "aliases": ["ociane", "ociane matmut"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.audioprothese@ociane.fr",
        "telephone": "02 35 03 68 00",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#005ea8",
    },
    {
        "nom": "Prévadiès",
        "aliases": ["prevadies", "prévadiès"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec@prevadies.fr",
        "telephone": "03 21 86 45 20",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#333333",
    },
    {
        "nom": "Eovi MCD",
        "aliases": ["eovi", "eovi mcd"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.audio@eovi-mcd.fr",
        "telephone": "04 75 75 70 70",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#333333",
    },
    {
        "nom": "Mutuelle Nationale des Hospitaliers (MNH)",
        "aliases": ["mnh", "mnh mutuelle"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec.audioprothese@mnh.fr",
        "telephone": "02 31 06 51 10",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 5,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle", "audiogramme"],
        "notes": "Hospitaliers : joindre l'audiogramme obligatoirement.",
        "couleur": "#005ea8",
    },
    {
        "nom": "Mutex Prévoyance",
        "aliases": ["mip", "mutex prévoyance"],
        "reseau": "direct",
        "portail_url": None,
        "portail_label": None,
        "email_pec": "pec@mutex.fr",
        "telephone": "01 40 47 67 83",
        "procedure_portail": False,
        "procedure_email": True,
        "delai_reponse_jours": 7,
        "documents_requis": ["devis", "ordonnance", "carte_mutuelle"],
        "couleur": "#333333",
    },
]

RESEAU_COULEURS: dict[str, str] = {
    "almerys": "#e65c00",
    "viamedis": "#0066cc",
    "santeclair": "#00a651",
    "oxantis": "#9b1d84",
    "seveane": "#e4002b",
    "direct": "#555555",
}

RESEAU_LABELS: dict[str, str] = {
    "almerys": "Réseau Almerys",
    "viamedis": "Réseau Viamedis",
    "santeclair": "Réseau Santeclair",
    "oxantis": "Réseau Oxantis",
    "seveane": "Réseau Séveane",
    "direct": "Gestion directe",
}

# Index par alias (lowercase) pour la recherche
_ALIAS_INDEX: dict[str, dict] = {}
for m in MUTUELLES:
    for alias in m["aliases"]:
        _ALIAS_INDEX[alias.lower()] = m
    _ALIAS_INDEX[m["nom"].lower()] = m


def find_mutuelle(name: str) -> Optional[dict]:
    """Recherche une mutuelle par nom approximatif."""
    if not name:
        return None
    name_lower = name.lower().strip()

    # Correspondance exacte d'abord
    if name_lower in _ALIAS_INDEX:
        return _ALIAS_INDEX[name_lower]

    # Correspondance partielle
    for alias, mutuelle in _ALIAS_INDEX.items():
        if alias in name_lower or name_lower in alias:
            return mutuelle

    return None


def get_mutuelles_by_reseau(reseau: str) -> list[dict]:
    return [m for m in MUTUELLES if m["reseau"] == reseau]


def list_reseaux() -> list[str]:
    return list(RESEAU_LABELS.keys())
