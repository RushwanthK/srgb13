"""Forecast accuracy metrics. All use valid forecast/actual pairs only.

Sign convention: error = forecast - actual. Positive => over-forecast
(less wind than expected => the utility would be short).
"""

import math
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.config import LONDON


def _num(value: Any) -> float | None:
    if value is None:
        return None
    value = float(value)
    return None if math.isnan(value) else value


def valid_pairs(comp: pd.DataFrame) -> pd.DataFrame:
    return comp[comp["forecast_mw"].notna() & comp["actual_mw"].notna()]


def mae(errors: pd.Series) -> float | None:
    return _num(errors.abs().mean()) if len(errors) else None


def rmse(errors: pd.Series) -> float | None:
    return _num(math.sqrt((errors**2).mean())) if len(errors) else None


def bias(errors: pd.Series) -> float | None:
    return _num(errors.mean()) if len(errors) else None


def mape(forecast: pd.Series, actual: pd.Series) -> tuple[float | None, int]:
    """Mean absolute percentage error, excluding zero actuals. Returns (value, excluded_count)."""
    nonzero = actual != 0
    excluded = int((~nonzero).sum())
    if not nonzero.any():
        return None, excluded
    value = ((forecast[nonzero] - actual[nonzero]).abs() / actual[nonzero].abs()).mean() * 100
    return _num(value), excluded


def wape(forecast: pd.Series, actual: pd.Series) -> float | None:
    denominator = actual.abs().sum()
    if denominator == 0:
        return None
    return _num((forecast - actual).abs().sum() / denominator * 100)


def compute_kpis(comp: pd.DataFrame) -> dict[str, Any]:
    pairs = valid_pairs(comp)
    errors = pairs["error_mw"]
    n_expected = len(comp)
    mape_value, mape_excluded = mape(pairs["forecast_mw"], pairs["actual_mw"])
    quantiles = errors.quantile([0.1, 0.9]) if len(errors) else pd.Series([np.nan, np.nan], index=[0.1, 0.9])
    return {
        "n_expected": n_expected,
        "n_matched": len(pairs),
        "n_missing_forecast": int(comp["forecast_mw"].isna().sum()),
        "n_missing_actual": int(comp["actual_mw"].isna().sum()),
        "coverage_pct": _num(len(pairs) / n_expected * 100) if n_expected else None,
        "mae_mw": mae(errors),
        "rmse_mw": rmse(errors),
        "bias_mw": bias(errors),
        "mape_pct": mape_value,
        "mape_excluded": mape_excluded,
        "wape_pct": wape(pairs["forecast_mw"], pairs["actual_mw"]),
        "p10_error_mw": _num(quantiles.loc[0.1]),
        "p90_error_mw": _num(quantiles.loc[0.9]),
        "p90_abs_error_mw": _num(errors.abs().quantile(0.9)) if len(errors) else None,
        "max_abs_error_mw": _num(errors.abs().max()) if len(errors) else None,
        "mean_actual_mw": _num(pairs["actual_mw"].mean()) if len(pairs) else None,
    }


def _local_hour(start_time: pd.Series) -> pd.Series:
    return start_time.dt.tz_convert(LONDON).dt.hour


def error_by_hour(comp: pd.DataFrame) -> list[dict[str, Any]]:
    """MAE, bias and P10/P90 signed error by local hour of day (0-23)."""
    pairs = valid_pairs(comp)
    result = []
    for hour in range(24):
        errors = pairs.loc[_local_hour(pairs["start_time"]) == hour, "error_mw"]
        result.append(
            {
                "hour": hour,
                "n": len(errors),
                "mae_mw": mae(errors),
                "bias_mw": bias(errors),
                "p10_error_mw": _num(errors.quantile(0.1)) if len(errors) else None,
                "p90_error_mw": _num(errors.quantile(0.9)) if len(errors) else None,
            }
        )
    return result


def daily_summary(comp: pd.DataFrame) -> list[dict[str, Any]]:
    result = []
    for day, group in comp.groupby("delivery_day", sort=True):
        pairs = valid_pairs(group)
        result.append(
            {
                "delivery_day": day,
                "n_matched": len(pairs),
                "mean_forecast_mw": _num(group["forecast_mw"].mean()),
                "mean_actual_mw": _num(group["actual_mw"].mean()),
                "mae_mw": mae(pairs["error_mw"]),
                "bias_mw": bias(pairs["error_mw"]),
                "wape_pct": wape(pairs["forecast_mw"], pairs["actual_mw"]),
            }
        )
    return result


def error_histogram(comp: pd.DataFrame, bin_width_mw: float = 500.0) -> list[dict[str, Any]]:
    errors = valid_pairs(comp)["error_mw"].to_numpy()
    if errors.size == 0:
        return []
    low = math.floor(errors.min() / bin_width_mw) * bin_width_mw
    high = math.ceil(errors.max() / bin_width_mw) * bin_width_mw
    if high <= low:
        high = low + bin_width_mw
    edges = np.arange(low, high + bin_width_mw, bin_width_mw)
    counts, edges = np.histogram(errors, bins=edges)
    return [
        {"bin_start_mw": float(edges[i]), "bin_end_mw": float(edges[i + 1]), "count": int(counts[i])}
        for i in range(len(counts))
    ]


# A band is only shown once this many past delivery days are available.
MIN_BAND_HISTORY_DAYS = 5
# Errors for day D-1 are not fully known at the D-1 decision cutoff, so the
# most recent usable day is D-2.
BAND_HISTORY_LAG = timedelta(days=2)


def add_error_band(comp: pd.DataFrame, day: date) -> pd.DataFrame:
    """Likely range of the actual for each hour of `day`, using only information
    available at decision time.

    History = valid pairs for delivery days <= day - 2 (their outcomes were known
    when the day-ahead decision for `day` was made). For each local hour, the
    P10/P90 signed error of that history gives the band. Since
    actual = forecast - error: low = forecast - P90, high = forecast - P10.
    With fewer than MIN_BAND_HISTORY_DAYS past days the band is left empty.
    """
    day_rows = comp[comp["delivery_day"] == day].copy()
    day_rows["band_low_mw"] = np.nan
    day_rows["band_high_mw"] = np.nan

    history = valid_pairs(comp[comp["delivery_day"] <= day - BAND_HISTORY_LAG])
    if history["delivery_day"].nunique() < MIN_BAND_HISTORY_DAYS:
        return day_rows

    stats = (
        history.assign(hour=_local_hour(history["start_time"]))
        .groupby("hour")["error_mw"]
        .quantile([0.1, 0.9])
        .unstack()
        .rename(columns={0.1: "p10", 0.9: "p90"})
    )
    hours = _local_hour(day_rows["start_time"])
    day_rows["band_low_mw"] = (day_rows["forecast_mw"] - hours.map(stats["p90"])).clip(lower=0)
    day_rows["band_high_mw"] = day_rows["forecast_mw"] - hours.map(stats["p10"])
    return day_rows


def band_coverage(comp: pd.DataFrame, days: list[date] | tuple[date, ...]) -> dict[str, Any]:
    """Back-test of the band: how often the actual fell inside it (nominal 80%)."""
    inside = total = 0
    for day in days:
        rows = add_error_band(comp, day)
        rows = rows[rows["band_low_mw"].notna() & rows["actual_mw"].notna()]
        inside += int(((rows["actual_mw"] >= rows["band_low_mw"]) & (rows["actual_mw"] <= rows["band_high_mw"])).sum())
        total += len(rows)
    return {
        "band_coverage_pct": _num(inside / total * 100) if total else None,
        "band_hours_evaluated": total,
    }
