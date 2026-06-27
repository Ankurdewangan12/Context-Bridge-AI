"""
ContextBridge AI — Backend Configuration
Loads environment variables from a .env file (kept OUT of version control).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Required: your Google Gemini API key
    GEMINI_API_KEY: str = ""

    # Optional: OpenAI fallback key (not wired in yet, reserved for future use)
    OPENAI_API_KEY: str = ""

    # Which Gemini model to use
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Comma-separated list of allowed CORS origins.
    # During development this can be "*". In production, set this to your
    # actual extension origin, e.g. "chrome-extension://abcdefghijklmnop"
    ALLOWED_ORIGINS: str = "*"

    # Safety cap on how much raw conversation text we will accept per request.
    # Prevents huge payloads from blowing up token usage / costs.
    MAX_CONVERSATION_CHARS: int = 60000

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def allowed_origins_list(self) -> list[str]:
        if self.ALLOWED_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]


# Single shared settings instance — import this elsewhere as `from config import settings`
settings = Settings()
