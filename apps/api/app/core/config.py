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
    openai_model: str = "gpt-4.1-mini"

    clerk_secret_key: str | None = None

    vapi_server_secret: str | None = None
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_sms_from_number: str | None = None
    voice_agent_user_id: str | None = None
    voice_business_timezone: str = "America/New_York"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def has_llm_key(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key)

    @property
    def llm_provider(self) -> tuple[str, str] | None:
        """(model, api_key) for whichever LLM provider has a key configured.

        Anthropic (llm_model) is preferred when both are set; OpenAI
        (openai_model) is the fallback. Every agent resolves its chat model
        through this one property instead of each hard-wiring its own
        provider/model/key choice - litellm.acompletion() then handles the
        actual provider call, so an agent never needs to know which vendor
        is live, only the (model, api_key) pair to pass through.
        """
        if self.anthropic_api_key:
            return self.llm_model, self.anthropic_api_key
        if self.openai_api_key:
            return self.openai_model, self.openai_api_key
        return None

    @property
    def has_voice_config(self) -> bool:
        return bool(
            self.vapi_server_secret
            and self.twilio_account_sid
            and self.twilio_auth_token
            and self.twilio_sms_from_number
            and self.voice_agent_user_id
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
