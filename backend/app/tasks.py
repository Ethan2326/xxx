"""
Tâches asynchrones Celery.
- Vérification des confirmations EDI
- Envoi des rappels de rendez-vous
- Nettoyage des sessions expirées
"""

from app.celery_app import celery_app
import structlog

log = structlog.get_logger()


@celery_app.task(name="app.tasks.check_edi_confirmations")
def check_edi_confirmations():
    """Vérifie les confirmations EDI des fabricants (ORDRSP)."""
    log.info("Vérification des confirmations EDI...")
    # TODO: Se connecter au SFTP du fabricant et traiter les ORDRSP reçus


@celery_app.task(name="app.tasks.send_appointment_reminders")
def send_appointment_reminders():
    """Envoie les rappels de RDV (SMS/email) 24h avant."""
    log.info("Envoi des rappels de rendez-vous...")
    # TODO: Récupérer les RDV de demain non rappelés et envoyer les notifications


@celery_app.task(name="app.tasks.sync_noah_patients")
def sync_noah_patients():
    """Synchronise les patients Noah 4 avec la base locale."""
    log.info("Synchronisation Noah 4...")
    # TODO: Appel async vers noah4_service


@celery_app.task(name="app.tasks.generate_monthly_report")
def generate_monthly_report():
    """Génère le rapport mensuel d'activité du centre."""
    log.info("Génération rapport mensuel...")
    # TODO: Statistiques mensuelles (patients, commandes, CA)
