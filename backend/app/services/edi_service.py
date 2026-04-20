"""
Service EDI (Electronic Data Interchange) pour les commandes d'appareils auditifs.
Utilise le standard EDIFACT ORDERS D.96A, le format standard du secteur audiologique.
Les principaux fabricants (Phonak, Oticon, Signia, ReSound, Widex, Starkey, Unitron)
supportent tous l'EDI EDIFACT pour les commandes B2B.
"""

import re
from datetime import datetime, date
from typing import Optional
from uuid import UUID, uuid4
import structlog

log = structlog.get_logger()


class EDISegment:
    """Représente un segment EDIFACT."""

    def __init__(self, tag: str, elements: list):
        self.tag = tag
        self.elements = elements

    def serialize(self) -> str:
        parts = [self.tag] + [str(e) if e is not None else "" for e in self.elements]
        return "+".join(parts) + "'"


class EDIMessage:
    """Message EDIFACT ORDERS (commande)."""

    def __init__(self, sender_id: str, receiver_id: str):
        self.sender_id = sender_id
        self.receiver_id = receiver_id
        self.interchange_ref = str(uuid4().int)[:14]
        self.message_ref = str(uuid4().int)[:14]
        self.segments: list[EDISegment] = []
        self.timestamp = datetime.utcnow()

    def build_order(self, order: dict) -> str:
        """
        Génère un message EDIFACT ORDERS D.96A.
        order: {
            numero_commande, fabricant, patient_nom, patient_prenom,
            patient_nir, adresse_livraison, items: [{reference, quantite, prix}]
        }
        """
        segs = []
        ts = self.timestamp
        date_str = ts.strftime("%y%m%d")
        time_str = ts.strftime("%H%M")

        # UNB - Interchange header
        segs.append(f"UNB+UNOA:2+{self.sender_id}:ZZ+{self.receiver_id}:ZZ+{date_str}:{time_str}+{self.interchange_ref}'")

        # UNH - Message header
        segs.append(f"UNH+{self.message_ref}+ORDERS:D:96A:UN'")

        # BGM - Beginning of message
        segs.append(f"BGM+220+{order['numero_commande']}+9'")

        # DTM - Date/Time
        segs.append(f"DTM+137:{ts.strftime('%Y%m%d')}:102'")

        # DTM - Livraison souhaitée
        if order.get("date_livraison_souhaitee"):
            dl = order["date_livraison_souhaitee"]
            if isinstance(dl, (datetime, date)):
                dl_str = dl.strftime("%Y%m%d") if isinstance(dl, datetime) else dl.strftime("%Y%m%d")
            else:
                dl_str = str(dl).replace("-", "")
            segs.append(f"DTM+2:{dl_str}:102'")

        # NAD+BY - Acheteur (centre audioprothétique)
        segs.append(f"NAD+BY+{self.sender_id}::9'")

        # NAD+SU - Fournisseur (fabricant)
        segs.append(f"NAD+SU+{self._get_fabricant_gln(order['fabricant'])}::9'")

        # NAD+DP - Adresse de livraison
        if order.get("adresse_livraison"):
            addr = order["adresse_livraison"].replace("\n", ":").replace(",", " ")
            segs.append(f"NAD+DP+++{addr}'")

        # RFF - Référence patient
        if order.get("patient_nir"):
            segs.append(f"RFF+PD:{order['patient_nir']}'")

        # Lignes de commande
        for i, item in enumerate(order.get("items", []), start=1):
            qty = item.get("quantite", 1)
            ref = item.get("reference", "")
            prix = item.get("prix_unitaire_ht", 0)
            designation = item.get("designation", "")[:35]

            segs.append(f"LIN+{i}++{ref}:SA'")
            segs.append(f"IMD+F++:::{designation}'")
            segs.append(f"QTY+21:{qty}'")
            segs.append(f"PRI+AAA:{prix:.2f}:CA::1:C62'")

            if item.get("numero_serie"):
                segs.append(f"RFF+SN:{item['numero_serie']}'")
            if item.get("motif_sav"):
                segs.append(f"FTX+ZZZ+++{item['motif_sav'][:70]}'")

        # UNS - Section control
        segs.append("UNS+S'")

        # CNT - Control total
        total_items = len(order.get("items", []))
        segs.append(f"CNT+2:{total_items}'")

        # Total montant
        total_ht = sum(
            i.get("prix_unitaire_ht", 0) * i.get("quantite", 1)
            for i in order.get("items", [])
        )
        segs.append(f"MOA+86:{total_ht:.2f}'")

        # UNT - Message trailer
        segs.append(f"UNT+{len(segs) + 1}+{self.message_ref}'")

        # UNZ - Interchange trailer
        segs.append(f"UNZ+1+{self.interchange_ref}'")

        return "\n".join(segs)

    def parse_ordrsp(self, edi_text: str) -> dict:
        """
        Parse un message EDIFACT ORDRSP (réponse de commande du fabricant).
        Retourne: {status, reference_fournisseur, message, items_status}
        """
        result = {
            "status": "unknown",
            "reference_fournisseur": None,
            "message": None,
            "items_status": [],
        }

        lines = edi_text.replace("'", "'\n").split("\n")
        for line in lines:
            line = line.strip().rstrip("'")
            if not line:
                continue
            parts = line.split("+")
            tag = parts[0]

            if tag == "BGM":
                # BGM+231 = confirmation, BGM+231:7 = refus
                if len(parts) > 1:
                    result["reference_fournisseur"] = parts[2] if len(parts) > 2 else None
                    result["status"] = "confirmed" if "231" in parts[1] else "rejected"

            elif tag == "FTX":
                if len(parts) > 4:
                    result["message"] = parts[4][:200]

            elif tag == "LIN":
                result["items_status"].append({
                    "line": parts[1] if len(parts) > 1 else "",
                    "reference": parts[2] if len(parts) > 2 else "",
                })

        return result

    def parse_desadv(self, edi_text: str) -> dict:
        """
        Parse un DESADV (avis d'expédition) du fabricant.
        """
        result = {
            "reference_expediteur": None,
            "date_expedition": None,
            "transporteur": None,
            "numero_suivi": None,
            "items": [],
        }

        lines = edi_text.replace("'", "'\n").split("\n")
        for line in lines:
            line = line.strip().rstrip("'")
            if not line:
                continue
            parts = line.split("+")
            tag = parts[0]

            if tag == "BGM":
                result["reference_expediteur"] = parts[2] if len(parts) > 2 else None

            elif tag == "DTM" and len(parts) > 1 and "11:" in parts[1]:
                date_val = parts[1].split(":")[1]
                try:
                    result["date_expedition"] = datetime.strptime(date_val, "%Y%m%d").date().isoformat()
                except ValueError:
                    pass

            elif tag == "TDT":
                result["transporteur"] = parts[2] if len(parts) > 2 else None

            elif tag == "RFF" and "AAK:" in line:
                result["numero_suivi"] = parts[1].split(":")[1] if ":" in parts[1] else None

            elif tag == "LIN":
                result["items"].append({
                    "ligne": parts[1] if len(parts) > 1 else "",
                    "reference": parts[2] if len(parts) > 2 else "",
                })

        return result

    @staticmethod
    def _get_fabricant_gln(fabricant: str) -> str:
        """GLN (Global Location Number) des principaux fabricants."""
        GLN_MAP = {
            "Phonak": "7612700901007",
            "Unitron": "7612700901014",
            "Oticon": "5712940000005",
            "Bernafon": "7640121580001",
            "ReSound": "5701793000008",
            "Beltone": "5701793000015",
            "Jabra": "5701793000022",
            "Signia": "4046871000009",
            "Sivantos": "4046871000016",
            "Widex": "5712100000006",
            "Starkey": "7896002000006",
            "Interton": "5701793000029",
        }
        return GLN_MAP.get(fabricant, "0000000000000")

    def generate_order_number(self, centre_code: str) -> str:
        """Génère un numéro de commande unique."""
        ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        return f"{centre_code}-{ts}-{uuid4().hex[:6].upper()}"


edi_service = EDIMessage(
    sender_id="AUDIOASSIST",
    receiver_id="FABRICANT"
)
