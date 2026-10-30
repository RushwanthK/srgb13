import math

import pandas as pd

from app.services.normalize import normalize_actuals, normalize_forecasts, to_hourly_actuals
from factories import ts

FUELHH = [
    {"publishTime": "2026-01-10T10:30:00Z", "startTime": "2026-01-10T10:00:00Z", "fuelType": "WIND", "generation": 8000},
    {"publishTime": "2026-01-10T11:00:00Z", "startTime": "2026-01-10T10:30:00Z", "fuelType": "WIND", "generation": 9000},
    {"publishTime": "2026-01-10T11:00:00Z", "startTime": "2026-01-10T10:30:00Z", "fuelType": "CCGT", "generation": 15000},
    {"publishTime": "2026-01-10T11:30:00Z", "startTime": "2026-01-10T11:00:00Z", "fuelType": "WIND", "generation": 7000},
]


def test_actuals_keep_wind_only():
    df, report = normalize_actuals(FUELHH)
    assert report.non_wind_rows == 1
    assert 15000 not in df["generation_mw"].tolist()
    assert report.valid_rows == 3


def test_actuals_invalid_rows_are_dropped_not_zeroed():
    records = FUELHH + [
        {"startTime": "2026-01-10T12:00:00Z", "fuelType": "WIND", "generation": None},
        {"startTime": "not-a-date", "fuelType": "WIND", "generation": 100},
        {"startTime": "2026-01-10T12:30:00Z", "fuelType": "WIND", "generation": -5},
    ]
    df, report = normalize_actuals(records)
    assert report.invalid_rows == 3
    assert 0 not in df["generation_mw"].tolist()
    assert len(df) == 3


def test_actuals_duplicates_keep_latest_publish():
    records = FUELHH + [
        {"publishTime": "2026-01-10T12:00:00Z", "startTime": "2026-01-10T10:00:00Z", "fuelType": "WIND", "generation": 8100},
    ]
    df, report = normalize_actuals(records)
    assert report.duplicate_rows == 1
    assert df.loc[df["start_time"] == ts("2026-01-10T10:00Z"), "generation_mw"].item() == 8100


def test_hourly_actuals_average_two_half_hours_and_flag_incomplete():
    df, _ = normalize_actuals(FUELHH)
    hourly = to_hourly_actuals(df).set_index("start_time")
    assert hourly.loc[ts("2026-01-10T10:00Z"), "actual_mw"] == 8500
    # 11:00 has only one half-hour -> missing, not 7000
    assert math.isnan(hourly.loc[ts("2026-01-10T11:00Z"), "actual_mw"])


def test_timestamps_are_utc_and_convert_to_london():
    df, _ = normalize_actuals(
        [{"startTime": "2026-07-10T09:00:00Z", "fuelType": "WIND", "generation": 1}]
    )
    start = df["start_time"].iloc[0]
    assert str(start.tz) == "UTC"
    assert start.tz_convert("Europe/London").hour == 10  # BST


def test_forecasts_keep_every_vintage_and_drop_exact_duplicates():
    records = [
        {"publishTime": "2026-01-09T09:30:00Z", "startTime": "2026-01-10T10:00:00Z", "generation": 8100},
        {"publishTime": "2026-01-09T11:30:00Z", "startTime": "2026-01-10T10:00:00Z", "generation": 8600},
        {"publishTime": "2026-01-09T11:30:00Z", "startTime": "2026-01-10T10:00:00Z", "generation": 8600},
        {"publishTime": None, "startTime": "2026-01-10T10:00:00Z", "generation": 1},
    ]
    df, report = normalize_forecasts(records)
    assert len(df) == 2
    assert report.duplicate_rows == 1
    assert report.invalid_rows == 1
    assert df["publish_time"].tolist() == [ts("2026-01-09T09:30Z"), ts("2026-01-09T11:30Z")]


def test_empty_input_returns_typed_empty_frames():
    actuals, _ = normalize_actuals([])
    forecasts, _ = normalize_forecasts([])
    assert actuals.empty and forecasts.empty
    assert isinstance(to_hourly_actuals(actuals), pd.DataFrame)
