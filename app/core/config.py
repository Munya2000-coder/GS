from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GS Private Capital Suite"
    environment: str = "development"
    database_url: str = "sqlite:///./gs_capital.db"
    secret_key: str = "change-me-in-production"
    token_ttl_minutes: int = 60
    allow_self_approval: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
