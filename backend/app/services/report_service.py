"""
Service de génération PDF des comptes rendus via reportlab.
"""

import io
from datetime import date
from typing import Optional
import json


def generate_pdf(report_data: dict, patient: dict, auteur: Optional[dict] = None) -> bytes:
    """Génère le PDF d'un compte rendu. Retourne les bytes du PDF."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2.5*cm, bottomMargin=2*cm
        )

        styles = getSampleStyleSheet()
        BRAND_COLOR = colors.HexColor('#1e3a8a')

        title_style = ParagraphStyle('Title', parent=styles['Heading1'], textColor=BRAND_COLOR, fontSize=14, spaceAfter=6)
        h2_style = ParagraphStyle('H2', parent=styles['Heading2'], textColor=BRAND_COLOR, fontSize=11, spaceAfter=4)
        body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=4)
        small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=colors.grey)

        story = []

        # En-tête
        today_str = date.today().strftime('%d/%m/%Y')
        auteur_name = f"{auteur.get('first_name', '')} {auteur.get('last_name', '')}" if auteur else "AudioAssist Pro"

        header_data = [[
            Paragraph(f"<b>AudioAssist Pro</b><br/>{auteur_name}", body_style),
            Paragraph(f"<b>Date :</b> {today_str}", body_style),
        ]]
        header_table = Table(header_data, colWidths=[10*cm, 7*cm])
        header_table.setStyle(TableStyle([('ALIGN', (1, 0), (1, 0), 'RIGHT')]))
        story.append(header_table)
        story.append(HRFlowable(width='100%', thickness=2, color=BRAND_COLOR, spaceAfter=12))

        # Titre
        story.append(Paragraph(report_data.get('titre', 'Compte rendu'), title_style))

        # Patient
        patient_info = (
            f"<b>Patient :</b> {patient.get('last_name', '')} {patient.get('first_name', '')} — "
            f"né(e) le {patient.get('birth_date', '')}"
        )
        story.append(Paragraph(patient_info, body_style))
        story.append(Spacer(1, 12))

        # Sections
        sections = report_data.get('sections', [])
        for section in sections:
            story.append(Paragraph(section.get('titre', ''), h2_style))
            content = section.get('contenu', '').replace('\n', '<br/>')
            story.append(Paragraph(content, body_style))
            story.append(Spacer(1, 8))

        story.append(HRFlowable(width='100%', thickness=1, color=colors.lightgrey, spaceAfter=8))
        story.append(Paragraph(
            "Document confidentiel généré par AudioAssist Pro — Usage médical exclusif",
            small_style
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        # Retourne un PDF minimal si reportlab n'est pas disponible
        return b"%PDF-1.4 (reportlab non disponible)"
