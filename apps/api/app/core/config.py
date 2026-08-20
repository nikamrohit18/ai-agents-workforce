from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    allowed_origins: str = "http://localhost:3000"

    database_url: str | None = None
    redis_url: str | None = None

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    llm_model: str = "claude-sonnet-4-5-20250929"

    clerk_secret_key: str | None = None

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def has_llm_key(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
