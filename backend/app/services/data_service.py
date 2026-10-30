"""Data access: Elexon client + cache + normalisation.

Routes ask this service for clean frames; they never talk to Elexon directly.
The raw (normalised) datasets are cached once, so changing scope or cutoff in
the UI only re-runs the cheap in-memory selection, not the download.
"""

from dataclasses import dataclass
from datetime import date, time

import pandas as pd

from app.config import (
    ACTUALS_SETTLEMENT_FROM,
    ACTUALS_SETTLEMENT_TO,
    FORECAST_PUBLISH_FROM,
    FORECAST_PUBLISH_TO,
)
from app.elexon_client import ElexonClient
from app.services.cache import TTLCache
from app.services.normalize import QualityReport, normalize_actuals, normalize_forecasts, to_hourly_actuals
from app.services.selection import build_comparison


@dataclass(frozen=True)
class ActualsData:
    hourly: pd.DataFrame
    report: QualityReport


@dataclass(frozen=True)
class ForecastsData:
    frame: pd.DataFrame
    report: QualityReport


class WindDataService:
    def __init__(self, client: ElexonClient, cache: TTLCache) -> None:
        self._client = client
        self._cache = cache

    def actuals(self) -> ActualsData:
        def load() -> ActualsData:
            records = self._client.fetch_wind_actuals(ACTUALS_SETTLEMENT_FROM, ACTUALS_SETTLEMENT_TO)
            half_hourly, report = normalize_actuals(records)
            return ActualsData(to_hourly_actuals(half_hourly), report)

        return self._cache.get_or_set("actuals", load)

    def forecasts(self) -> ForecastsData:
        def load() -> ForecastsData:
            records = self._client.fetch_wind_forecasts(FORECAST_PUBLISH_FROM, FORECAST_PUBLISH_TO)
            frame, report = normalize_forecasts(records)
            return ForecastsData(frame, report)

        return self._cache.get_or_set("forecasts", load)

    def comparison(self, days: list[date], cutoff: time) -> pd.DataFrame:
        return build_comparison(self.forecasts().frame, self.actuals().hourly, days, cutoff)
