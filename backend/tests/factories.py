"""Small synthetic builders shared by the tests (never used at runtime)."""

import pandas as pd


def ts(value: str) -> pd.Timestamp:
    return pd.to_datetime(value, utc=True).as_unit("ns")


def forecast_frame(rows: list[tuple[str, str, float]]) -> pd.DataFrame:
    """rows: (start_time, publish_time, forecast_mw) as ISO strings (UTC)."""
    return pd.DataFrame(
        {
            "start_time": pd.Series([ts(r[0]) for r in rows], dtype="datetime64[ns, UTC]"),
            "publish_time": pd.Series([ts(r[1]) for r in rows], dtype="datetime64[ns, UTC]"),
            "forecast_mw": [float(r[2]) for r in rows],
        }
    )


def actual_frame(rows: list[tuple[str, float | None]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "start_time": pd.Series([ts(r[0]) for r in rows], dtype="datetime64[ns, UTC]"),
            "actual_mw": [float("nan") if r[1] is None else float(r[1]) for r in rows],
        }
    )


def comparison_frame(pairs: list[tuple[float | None, float | None]], day: str = "2026-01-10") -> pd.DataFrame:
    """Minimal comparison frame (consecutive hours on one day) for metric tests."""
    forecast = pd.Series([float("nan") if f is None else f for f, _ in pairs], dtype=float)
    actual = pd.Series([float("nan") if a is None else a for _, a in pairs], dtype=float)
    return pd.DataFrame(
        {
            "start_time": pd.date_range(f"{day}T00:00Z", periods=len(pairs), freq="h").as_unit("ns"),
            "delivery_day": pd.Timestamp(day).date(),
            "forecast_mw": forecast,
            "actual_mw": actual,
            "error_mw": forecast - actual,
        }
    )
