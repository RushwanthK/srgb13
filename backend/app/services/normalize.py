"""Turn raw Elexon records into clean, typed, UTC-indexed DataFrames.

Rules:
- invalid rows (unparseable time, null/negative generation) are dropped, never zero-filled;
- duplicates keep the most recently published record;
- all timestamps are tz-aware UTC with nanosecond resolution.
"""

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class QualityReport:
    raw_rows: int = 0
    non_wind_rows: int = 0
    invalid_rows: int = 0
    duplicate_rows: int = 0
    valid_rows: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


def to_utc(values: Any) -> pd.Series:
    """Parse to tz-aware UTC datetimes; unparseable values become NaT."""
    return pd.Series(pd.to_datetime(values, utc=True, errors="coerce")).dt.as_unit("ns")


def _column(df: pd.DataFrame, name: str) -> pd.Series:
    return df[name] if name in df.columns else pd.Series([None] * len(df), index=df.index)


def normalize_actuals(records: list[dict[str, Any]]) -> tuple[pd.DataFrame, QualityReport]:
    """FUELHH records -> [start_time, publish_time, generation_mw] (half-hourly, WIND only)."""
    report = QualityReport(raw_rows=len(records))
    df = pd.DataFrame.from_records(records)
    if df.empty:
        return pd.DataFrame(
            {"start_time": to_utc([]), "publish_time": to_utc([]), "generation_mw": pd.Series(dtype=float)}
        ), report

    is_wind = _column(df, "fuelType").astype(str).str.upper() == "WIND"
    report.non_wind_rows = int((~is_wind).sum())
    df = df[is_wind]

    out = pd.DataFrame(
        {
            "start_time": to_utc(_column(df, "startTime").to_numpy()),
            "publish_time": to_utc(_column(df, "publishTime").to_numpy()),
            "generation_mw": pd.to_numeric(_column(df, "generation"), errors="coerce").to_numpy(),
        }
    )
    valid = out["start_time"].notna() & out["generation_mw"].notna() & (out["generation_mw"] >= 0)
    report.invalid_rows = int((~valid).sum())
    out = out[valid]

    before = len(out)
    out = (
        out.sort_values(["start_time", "publish_time"], na_position="first")
        .drop_duplicates("start_time", keep="last")
        .reset_index(drop=True)
    )
    report.duplicate_rows = before - len(out)
    report.valid_rows = len(out)
    return out, report


def to_hourly_actuals(actuals: pd.DataFrame) -> pd.DataFrame:
    """Average the two half-hours of each hour.

    WINDFOR is hourly, so actuals are aggregated to match. An hour with only one
    half-hour present is marked missing (NaN) rather than averaged from partial data.
    """
    if actuals.empty:
        return pd.DataFrame({"start_time": to_utc([]), "actual_mw": pd.Series(dtype=float)})
    hourly = (
        actuals.assign(start_time=actuals["start_time"].dt.floor("h"))
        .groupby("start_time")["generation_mw"]
        .agg(actual_mw="mean", half_hours="count")
        .reset_index()
    )
    hourly.loc[hourly["half_hours"] < 2, "actual_mw"] = np.nan
    return hourly[["start_time", "actual_mw"]]


def normalize_forecasts(records: list[dict[str, Any]]) -> tuple[pd.DataFrame, QualityReport]:
    """WINDFOR records -> [start_time, publish_time, forecast_mw]; every vintage is kept."""
    report = QualityReport(raw_rows=len(records))
    df = pd.DataFrame.from_records(records)
    if df.empty:
        return pd.DataFrame(
            {"start_time": to_utc([]), "publish_time": to_utc([]), "forecast_mw": pd.Series(dtype=float)}
        ), report

    out = pd.DataFrame(
        {
            "start_time": to_utc(_column(df, "startTime").to_numpy()),
            "publish_time": to_utc(_column(df, "publishTime").to_numpy()),
            "forecast_mw": pd.to_numeric(_column(df, "generation"), errors="coerce").to_numpy(),
        }
    )
    valid = (
        out["start_time"].notna()
        & out["publish_time"].notna()
        & out["forecast_mw"].notna()
        & (out["forecast_mw"] >= 0)
    )
    report.invalid_rows = int((~valid).sum())
    out = out[valid]

    before = len(out)
    out = (
        out.drop_duplicates(["start_time", "publish_time"], keep="last")
        .sort_values(["start_time", "publish_time"])
        .reset_index(drop=True)
    )
    report.duplicate_rows = before - len(out)
    report.valid_rows = len(out)
    return out, report
