from datetime import date, datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import settings
from app.routes.deps import CUTOFF_PATTERN, AnalysisParams, analysis_params, get_service, records, scope_info
from app.schemas import EvolutionResponse, ForecastsResponse
from app.services import metrics
from app.services.data_service import WindDataService
from app.services.selection import HISTORY_DAYS, cutoff_for, forecast_evolution, london_date, parse_cutoff

router = APIRouter(prefix="/forecasts", tags=["forecasts"])

ROW_COLUMNS = [
    "start_time",
    "delivery_day",
    "cutoff_time",
    "publish_time",
    "forecast_mw",
    "actual_mw",
    "error_mw",
    "abs_error_mw",
    "pct_error",
    "horizon_hours",
    "status",
]


@router.get("", response_model=ForecastsResponse)
def forecasts(
    date_: date | None = Query(None, alias="date", description="Delivery day; omit for the whole scope"),
    params: AnalysisParams = Depends(analysis_params),
    service: WindDataService = Depends(get_service),
) -> ForecastsResponse:
    """Selected (as-of) forecast vs actual per delivery hour.

    With `date`, rows are limited to that day and include a P10-P90 band built
    only from delivery days <= D-2 (information available at decision time),
    plus the band's observed coverage across the scope.
    """
    columns = ROW_COLUMNS
    band: dict = {}
    if date_ is not None:
        if date_ not in params.scope.delivery_days:
            raise HTTPException(status_code=404, detail=f"{date_} is not a delivery day in this scope.")
        # Band history may reach back before the scope (e.g. 31 Dec), but only to days <= D-2.
        history = service.comparison(list(HISTORY_DAYS), params.cutoff)
        comp = metrics.add_error_band(history, date_)
        band = metrics.band_coverage(history, params.scope.delivery_days)
        columns = ROW_COLUMNS + ["band_low_mw", "band_high_mw"]
    else:
        comp = service.comparison(params.days, params.cutoff)

    runs_used = sorted(comp["publish_time"].dropna().unique())
    return ForecastsResponse(
        scope=scope_info(params),
        date=date_,
        cutoff_time=cutoff_for(date_, params.cutoff) if date_ is not None else None,
        runs_used=[pd.Timestamp(r) for r in runs_used],
        kpis=metrics.compute_kpis(comp),
        rows=records(comp, columns),
        band_min_history_days=metrics.MIN_BAND_HISTORY_DAYS,
        **band,
    )


@router.get("/evolution", response_model=EvolutionResponse)
def evolution(
    start_time: datetime = Query(..., description="Delivery hour start (ISO 8601, timezone-aware)"),
    cutoff: str = Query(settings.default_cutoff, pattern=CUTOFF_PATTERN),
    service: WindDataService = Depends(get_service),
) -> EvolutionResponse:
    """Every forecast run issued for one delivery hour, relative to the decision cutoff."""
    if start_time.tzinfo is None:
        raise HTTPException(status_code=422, detail="start_time must include a timezone (e.g. Z).")
    ts = pd.Timestamp(start_time).tz_convert("UTC").as_unit("ns")
    if ts.minute or ts.second:
        raise HTTPException(status_code=422, detail="start_time must be on the hour.")
    if not date(2026, 1, 1) <= london_date(ts) <= date(2026, 2, 1):
        raise HTTPException(status_code=404, detail="start_time is outside the January 2026 analysis window.")

    evo = forecast_evolution(service.forecasts().frame, service.actuals().hourly, ts, parse_cutoff(cutoff))
    selected = evo.runs.loc[evo.runs["is_selected"], "forecast_mw"]
    return EvolutionResponse(
        start_time=evo.start_time,
        cutoff=cutoff,
        cutoff_time=evo.cutoff_time,
        selected_publish_time=evo.selected_publish_time,
        selected_forecast_mw=float(selected.iloc[0]) if not selected.empty else None,
        actual_mw=evo.actual_mw,
        runs=records(evo.runs),
    )
