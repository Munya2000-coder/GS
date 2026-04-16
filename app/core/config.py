from functools import lru_cache

from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GS Private Capital Suite"
    environment: str = Field(default="development", pattern=r"^(development|staging|production|test)$")
    database_url: str = "sqlite:///./gs_capital.db"
    secret_key: str = "change-me-in-production"
    token_ttl_minutes: int = 60
    allow_self_approval: bool = False
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    enable_security_headers: bool = True
    rate_limit_per_minute: int = 600

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("secret_key")
    @classmethod
    def _validate_secret(cls, v: str, info: ValidationInfo) -> str:
        env = info.data.get("environment", "development")
        if env == "production" and v == "change-me-in-production":
            raise ValueError("SECRET_KEY must be set in production")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
