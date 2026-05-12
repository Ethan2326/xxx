from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from typing import Optional
import os


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AudioAssist Pro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://audioassist:audioassist@db:5432/audioassist"
    DATABASE_URL_SYNC: str = "postgresql://audioassist:audioassist@db:5432/audioassist"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def ensure_async_driver(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"

    # Noah 4
    NOAH4_HOST: str = "localhost"
    NOAH4_PORT: int = 1337
    NOAH4_TIMEOUT: int = 30

    # AudioWizard
    AUDIOWIZARD_URL: str = ""
    AUDIOWIZARD_API_KEY: str = ""

    # Cosium
    COSIUM_URL: str = ""
    COSIUM_USERNAME: str = ""
    COSIUM_PASSWORD: str = ""

    # EDI
    EDI_SFTP_HOST: str = ""
    EDI_SFTP_PORT: int = 22
    EDI_SFTP_USER: str = ""
    EDI_SFTP_KEY_PATH: str = ""
    EDI_SENDER_ID: str = ""
    EDI_RECEIVER_ID: str = ""

    # SMTP (envoi emails PEC mutuelles)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_SENDER_NAME: str = "AudioAssist Pro"
    SMTP_SENDER_EMAIL: str = ""
    SMTP_BCC_CENTRE: str = ""  # BCC automatique sur toutes les PEC

    # ─── LinkedIn Lead Scraper ────────────────────────────────────────────────
    PROXYCURL_API_KEY: str = ""
    APIFY_API_TOKEN: str = ""
    LINKEDIN_SCRAPER_PROVIDER: str = "proxycurl"  # "proxycurl" | "apify"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://frontend-1w0c.onrender.com",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
