"""Application settings (overridable through environment variables or a .env file)."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    elexon_base_url: str = "https://data.elexon.co.uk/bmrs/api/v1"
    http_timeout_s: float = 30.0
    http_max_retries: int = 3
    cache_ttl_s: int = 3600
    # Illustrative default only: the brief does not specify a decision time.
    default_cutoff: str = "10:00"
    # Comma-separated list. Only needed when the frontend is served from another origin.
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

LONDON = ZoneInfo("Europe/London")
UTC = timezone.utc

# Fetch windows are the union of both January-2026 interpretations
# (decision-date: delivery 2 Jan - 1 Feb; delivery-date: delivery 1 - 31 Jan),
# padded so any cutoff time of day can find an earlier forecast run.
ACTUALS_SETTLEMENT_FROM = date(2025, 12, 31)
ACTUALS_SETTLEMENT_TO = date(2026, 2, 2)
FORECAST_PUBLISH_FROM = datetime(2025, 12, 30, 0, 0, tzinfo=UTC)
FORECAST_PUBLISH_TO = datetime(2026, 2, 2, 0, 0, tzinfo=UTC)
