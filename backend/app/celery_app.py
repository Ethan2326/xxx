from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "audioassist",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Paris",
    enable_utc=True,
    beat_schedule={
        "check-edi-confirmations": {
            "task": "app.tasks.check_edi_confirmations",
            "schedule": 3600.0,  # toutes les heures
        },
        "send-appointment-reminders": {
            "task": "app.tasks.send_appointment_reminders",
            "schedule": 1800.0,  # toutes les 30 min
        },
    },
)
