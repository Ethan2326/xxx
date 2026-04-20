from fastapi import APIRouter
from .auth import router as auth_router
from .patients import router as patients_router
from .audiograms import router as audiograms_router
from .orders import router as orders_router
from .fitting import router as fitting_router
from .chatbot import router as chatbot_router
from .reports import router as reports_router
from .integrations import router as integrations_router
from .appointments import router as appointments_router
from .catalog import router as catalog_router
from .pec import router as pec_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router,         prefix="/auth",         tags=["Authentification"])
api_router.include_router(patients_router,     prefix="/patients",     tags=["Patients"])
api_router.include_router(audiograms_router,   prefix="/audiograms",   tags=["Audiogrammes"])
api_router.include_router(orders_router,       prefix="/orders",       tags=["Commandes EDI"])
api_router.include_router(fitting_router,      prefix="/fitting",      tags=["Assistant réglage"])
api_router.include_router(chatbot_router,      prefix="/chatbot",      tags=["Chatbot Audition"])
api_router.include_router(reports_router,      prefix="/reports",      tags=["Comptes rendus"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["Intégrations"])
api_router.include_router(appointments_router, prefix="/appointments", tags=["Agenda"])
api_router.include_router(catalog_router,      prefix="/catalog",      tags=["Catalogue"])
api_router.include_router(pec_router,          prefix="/pec",          tags=["Prises en charge mutuelles"])
