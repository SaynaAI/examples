"""Application settings.

Defaults match the bundled `examples/sayna.example.yaml` so the example
runs out-of-the-box against a local Sayna dev server. Override any value
via environment variables or a `.env` file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    sayna_url: str = "http://localhost:3001"
    sayna_api_key: str = "secret-key-1234567890"
    sayna_webhook_secret: str = "hook-secret-1234567890"

    google_api_key: str = ""

    elevenlabs_voice_id: str = "ZIlrSGI4jZqobxRKprJz"

    port: int = 5002


settings = Settings()
