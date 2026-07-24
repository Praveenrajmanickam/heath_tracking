from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RefluxCare API"
    database_url: str = (
        "postgresql+psycopg://refluxcare:refluxcare-local@localhost:5432/refluxcare"
    )
    cors_origins: str = "http://localhost:5173"
    # When set, every data request must send this passcode. Empty means no lock
    # (fine for local development; always set it in production via APP_PASSCODE).
    app_passcode: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin]


@lru_cache
def get_settings() -> Settings:
    return Settings()

