from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


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

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
