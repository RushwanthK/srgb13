"""Historical (as-of) forecast selection: the core business logic.

For every delivery hour h on delivery day D:
    cutoff   = D-1 at HH:MM Europe/London (converted to UTC)
    selected = the WINDFOR row with startTime == h and the greatest
               publishTime <= cutoff.
A forecast published after the cutoff is never used. If nothing was
published before the cutoff, the hour is reported as unavailable.
"""

import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Literal

import numpy as np
import pandas as pd

from app.config import LONDON

Scope = Literal["decision", "delivery"]

_CUTOFF_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_JANUARY_2026 = tuple(date(2026, 1, d) for d in range(1, 32))
_ONE_DAY = timedelta(days=1)

# Every delivery day we hold data for (31 Dec 2025 - 1 Feb 2026). Used as error
# history for the uncertainty band, which may look back before the selected scope.
HISTORY_DAYS = tuple(date(2025, 12, 31) + timedelta(days=i) for i in range(33))


@dataclass(frozen=True)
class ScopeDefinition:
    scope: Scope
    label: str
    description: str
    decision_days: tuple[date, ...]
    delivery_days: tuple[date, ...]


def get_scope(scope: Scope) -> ScopeDefinition:
    if scope == "decision":
        return ScopeDefinition(
            scope="decision",
            label="Decisions made in January 2026",
            description="Decision days 1-31 Jan 2026; delivery days 2 Jan - 1 Feb 2026.",
            decision_days=_JANUARY_2026,
            delivery_days=tuple(d + _ONE_DAY for d in _JANUARY_2026),
        )
    if scope == "delivery":
        return ScopeDefinition(
            scope="delivery",
            label="Delivery in January 2026",
            description="Delivery days 1-31 Jan 2026; decision days 31 Dec 2025 - 30 Jan 2026.",
            decision_days=tuple(d - _ONE_DAY for d in _JANUARY_2026),
            delivery_days=_JANUARY_2026,
        )
    raise ValueError(f"Unknown scope: {scope}")


def parse_cutoff(value: str) -> time:
    match = _CUTOFF_RE.match(value)
    if not match:
        raise ValueError("cutoff must be HH:MM (24h)")
    return time(int(match.group(1)), int(match.group(2)))


def cutoff_for(delivery_day: date, cutoff: time) -> pd.Timestamp:
    """Decision cutoff (UTC) for a delivery day: the previous local day at `cutoff`."""
    local = datetime.combine(delivery_day - _ONE_DAY, cutoff, tzinfo=LONDON)
    return pd.Timestamp(local).tz_convert("UTC").as_unit("ns")


def delivery_hours(delivery_day: date) -> pd.DatetimeIndex:
    """UTC start times of every hour in a local (Europe/London) delivery day.

    23, 24 or 25 hours depending on daylight-saving transitions.
    """
    start = pd.Timestamp(datetime.combine(delivery_day, time(0), tzinfo=LONDON)).tz_convert("UTC")
    end = pd.Timestamp(datetime.combine(delivery_day + _ONE_DAY, time(0), tzinfo=LONDON)).tz_convert("UTC")
    return pd.date_range(start, end, freq="h", inclusive="left").as_unit("ns")


def london_date(ts: pd.Timestamp) -> date:
    return ts.tz_convert(LONDON).date()


def build_targets(days: list[date] | tuple[date, ...], cutoff: time) -> pd.DataFrame:
    """One row per delivery hour with its decision cutoff."""
    frames = [
        pd.DataFrame(
            {
                "start_time": delivery_hours(day),
                "delivery_day": day,
                "cutoff_time": cutoff_for(day, cutoff),
            }
        )
        for day in days
    ]
    if not frames:
        return pd.DataFrame(columns=["start_time", "delivery_day", "cutoff_time"])
    return pd.concat(frames, ignore_index=True)


def select_latest_forecast(forecasts: pd.DataFrame, targets: pd.DataFrame) -> pd.DataFrame:
    """Attach the latest forecast published at or before each target's cutoff.

    Returns `targets` plus `publish_time` and `forecast_mw` (NaN/NaT when unavailable).
    """
    candidates = targets.merge(forecasts, on="start_time", how="inner")
    eligible = candidates[candidates["publish_time"] <= candidates["cutoff_time"]]
    latest = (
        eligible.sort_values(["start_time", "publish_time"])
        .drop_duplicates("start_time", keep="last")[["start_time", "publish_time", "forecast_mw"]]
    )
    return targets.merge(latest, on="start_time", how="left")


def build_comparison(
    forecasts: pd.DataFrame,
    hourly_actuals: pd.DataFrame,
    days: list[date] | tuple[date, ...],
    cutoff: time,
) -> pd.DataFrame:
    """Selected forecast vs actual for every delivery hour, with error columns.

    error_mw = forecast - actual (positive = over-forecast).
    """
    comp = select_latest_forecast(forecasts, build_targets(days, cutoff))
    comp = comp.merge(hourly_actuals[["start_time", "actual_mw"]], on="start_time", how="left")

    comp["error_mw"] = comp["forecast_mw"] - comp["actual_mw"]
    comp["abs_error_mw"] = comp["error_mw"].abs()
    with np.errstate(divide="ignore", invalid="ignore"):
        comp["pct_error"] = np.where(comp["actual_mw"] > 0, comp["error_mw"] / comp["actual_mw"] * 100, np.nan)
    comp["horizon_hours"] = (comp["start_time"] - comp["publish_time"]) / pd.Timedelta(hours=1)

    has_f = comp["forecast_mw"].notna()
    has_a = comp["actual_mw"].notna()
    comp["status"] = np.select(
        [has_f & has_a, ~has_f & has_a, has_f & ~has_a],
        ["ok", "missing_forecast", "missing_actual"],
        default="missing_both",
    )
    return comp


@dataclass(frozen=True)
class Evolution:
    start_time: pd.Timestamp
    cutoff_time: pd.Timestamp
    selected_publish_time: pd.Timestamp | None
    actual_mw: float | None
    runs: pd.DataFrame  # publish_time, forecast_mw, horizon_hours, is_selected, after_cutoff


def forecast_evolution(
    forecasts: pd.DataFrame, hourly_actuals: pd.DataFrame, start_time: pd.Timestamp, cutoff: time
) -> Evolution:
    """Every forecast run issued before delivery for one hour, flagged relative to the cutoff."""
    cutoff_ts = cutoff_for(london_date(start_time), cutoff)
    runs = forecasts[(forecasts["start_time"] == start_time) & (forecasts["publish_time"] <= start_time)]
    runs = runs.sort_values("publish_time")[["publish_time", "forecast_mw"]].reset_index(drop=True)

    eligible = runs[runs["publish_time"] <= cutoff_ts]
    selected = eligible["publish_time"].iloc[-1] if not eligible.empty else None

    runs["horizon_hours"] = (start_time - runs["publish_time"]) / pd.Timedelta(hours=1)
    runs["is_selected"] = runs["publish_time"] == selected if selected is not None else False
    runs["after_cutoff"] = runs["publish_time"] > cutoff_ts

    actual = hourly_actuals.loc[hourly_actuals["start_time"] == start_time, "actual_mw"]
    actual_mw = float(actual.iloc[0]) if not actual.empty and pd.notna(actual.iloc[0]) else None
    return Evolution(start_time, cutoff_ts, selected, actual_mw, runs)
