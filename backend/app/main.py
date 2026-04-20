from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import get_settings
from app.database import engine, Base
from app.api.v1.router import api_router
import structlog

settings = get_settings()
log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("AudioAssist Pro démarrage", version=settings.APP_VERSION)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    log.info("AudioAssist Pro arrêt")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Plateforme IA pour audioprothésistes — "
        "Intégration Noah 4 / AudioWizard / Cosium, commandes EDI, "
        "assistant réglage IA, chatbot audition, générateur de comptes rendus."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
