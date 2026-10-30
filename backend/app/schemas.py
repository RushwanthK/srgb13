"""Pydantic response models (mirrored in frontend/src/types/api.ts).

All datetimes are UTC; the frontend renders them in Europe/London.
Power values are MW. Errors are forecast - actual.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel

Status = Literal["ok", "missing_forecast", "missing_actual", "missing_both"]


class ScopeInfo(BaseModel):
    scope: Literal["decision", "delivery"]
    label: str
    description: str
    decision_from: date
    decision_to: date
    delivery_from: date
    delivery_to: date
    cutoff: str
    timezone: str = "Europe/London"


class Kpis(BaseModel):
    n_expected: int
    n_matched: int
    n_missing_forecast: int
    n_missing_actual: int
    coverage_pct: float | None
    mae_mw: float | None
    rmse_mw: float | None
    bias_mw: float | None
    mape_pct: float | None
    mape_excluded: int
    wape_pct: float | None
    p10_error_mw: float | None
    p90_error_mw: float | None
    p90_abs_error_mw: float | None
    max_abs_error_mw: float | None
    mean_actual_mw: float | None


class MetaResponse(BaseModel):
    scope: ScopeInfo
    delivery_days: list[date]
    default_cutoff: str
    data_sources: list[str]
    assumptions: list[str]


class SeriesPoint(BaseModel):
    start_time: datetime
    forecast_mw: float | None
    actual_mw: float | None


class DailyPoint(BaseModel):
    delivery_day: date
    n_matched: int
    mean_forecast_mw: float | None
    mean_actual_mw: float | None
    mae_mw: float | None
    bias_mw: float | None
    wape_pct: float | None


class OverviewResponse(BaseModel):
    scope: ScopeInfo
    kpis: Kpis
    series: list[SeriesPoint]
    daily: list[DailyPoint]


class ComparisonRow(BaseModel):
    start_time: datetime
    delivery_day: date
    cutoff_time: datetime
    publish_time: datetime | None
    forecast_mw: float | None
    actual_mw: float | None
    error_mw: float | None
    abs_error_mw: float | None
    pct_error: float | None
    horizon_hours: float | None
    status: Status
    band_low_mw: float | None = None
    band_high_mw: float | None = None


class ForecastsResponse(BaseModel):
    scope: ScopeInfo
    date: date | None
    cutoff_time: datetime | None
    runs_used: list[datetime]
    kpis: Kpis
    rows: list[ComparisonRow]
    # Back-test of the P10-P90 band over the scope (only when `date` is given).
    band_coverage_pct: float | None = None
    band_hours_evaluated: int = 0
    band_min_history_days: int


class EvolutionRun(BaseModel):
    publish_time: datetime
    forecast_mw: float
    horizon_hours: float
    is_selected: bool
    after_cutoff: bool


class EvolutionResponse(BaseModel):
    start_time: datetime
    cutoff: str
    cutoff_time: datetime
    selected_publish_time: datetime | None
    selected_forecast_mw: float | None
    actual_mw: float | None
    runs: list[EvolutionRun]


class HourStat(BaseModel):
    hour: int
    n: int
    mae_mw: float | None
    bias_mw: float | None
    p10_error_mw: float | None
    p90_error_mw: float | None


class HistogramBin(BaseModel):
    bin_start_mw: float
    bin_end_mw: float
    count: int


class DataQuality(BaseModel):
    actuals: dict[str, int]
    forecasts: dict[str, int]
    expected_hours: int
    matched_hours: int
    missing_forecast_hours: int
    missing_actual_hours: int
    mape_excluded_hours: int


class AccuracyResponse(BaseModel):
    scope: ScopeInfo
    kpis: Kpis
    by_hour: list[HourStat]
    daily: list[DailyPoint]
    histogram: list[HistogramBin]
    quality: DataQuality
