"""Shared route dependencies: service wiring, query-param parsing and serialisation helpers."""

from dataclasses import dataclass
from datetime import date, time
from functools import lru_cache
from typing import Any, Literal

import pandas as pd
from fastapi import HTTPException, Query

from app.config import settings
from app.elexon_client import ElexonClient
from app.schemas import ScopeInfo
from app.services.cache import TTLCache
from app.services.data_service import WindDataService
from app.services.selection import ScopeDefinition, get_scope, parse_cutoff

CUTOFF_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


@lru_cache
def get_service() -> WindDataService:
    client = ElexonClient(settings.elexon_base_url, settings.http_timeout_s, settings.http_max_retries)
    return WindDataService(client, TTLCache(settings.cache_ttl_s))


@dataclass(frozen=True)
class AnalysisParams:
    scope: ScopeDefinition
    cutoff: time
    cutoff_str: str
    days: list[date]


def analysis_params(
    scope: Literal["decision", "delivery"] = Query("decision", description="January 2026 interpretation"),
    cutoff: str = Query(settings.default_cutoff, pattern=CUTOFF_PATTERN, description="Decision time on D-1, HH:MM Europe/London"),
    date_from: date | None = Query(None, alias="from", description="First delivery day (inclusive)"),
    date_to: date | None = Query(None, alias="to", description="Last delivery day (inclusive)"),
) -> AnalysisParams:
    definition = get_scope(scope)
    days = [
        d
        for d in definition.delivery_days
        if (date_from is None or d >= date_from) and (date_to is None or d <= date_to)
    ]
    if not days:
        raise HTTPException(status_code=422, detail="No delivery days in the selected scope match from/to.")
    return AnalysisParams(definition, parse_cutoff(cutoff), cutoff, days)


def scope_info(params: AnalysisParams) -> ScopeInfo:
    s = params.scope
    return ScopeInfo(
        scope=s.scope,
        label=s.label,
        description=s.description,
        decision_from=s.decision_days[0],
        decision_to=s.decision_days[-1],
        delivery_from=s.delivery_days[0],
        delivery_to=s.delivery_days[-1],
        cutoff=params.cutoff_str,
    )


def records(df: pd.DataFrame, columns: list[str] | None = None) -> list[dict[str, Any]]:
    """DataFrame -> list of dicts with NaN/NaT converted to None."""
    if columns is not None:
        df = df[columns]
    return df.astype(object).where(df.notna(), None).to_dict("records")
