import math
from datetime import date, time

import pandas as pd

from app.services.selection import (
    build_comparison,
    build_targets,
    cutoff_for,
    delivery_hours,
    forecast_evolution,
    get_scope,
    parse_cutoff,
    select_latest_forecast,
)
from factories import actual_frame, forecast_frame, ts

import pytest

TEN = time(10, 0)


def test_cutoff_is_previous_local_day():
    # January: London == UTC
    assert cutoff_for(date(2026, 1, 10), TEN) == ts("2026-01-09T10:00Z")
    # Summer: London == UTC+1, so 10:00 local is 09:00 UTC
    assert cutoff_for(date(2026, 7, 10), TEN) == ts("2026-07-09T09:00Z")


def test_delivery_hours_respect_dst():
    assert len(delivery_hours(date(2026, 1, 10))) == 24
    assert len(delivery_hours(date(2026, 3, 29))) == 23  # clocks go forward
    assert len(delivery_hours(date(2026, 10, 25))) == 25  # clocks go back
    assert delivery_hours(date(2026, 7, 10))[0] == ts("2026-07-09T23:00Z")


def test_parse_cutoff_validation():
    assert parse_cutoff("09:50") == time(9, 50)
    for bad in ("9:50", "24:00", "10:60", "abc"):
        with pytest.raises(ValueError):
            parse_cutoff(bad)


def test_scopes_do_not_mix():
    decision = get_scope("decision")
    delivery = get_scope("delivery")
    assert decision.delivery_days[0] == date(2026, 1, 2)
    assert decision.delivery_days[-1] == date(2026, 2, 1)
    assert delivery.delivery_days[0] == date(2026, 1, 1)
    assert delivery.delivery_days[-1] == date(2026, 1, 31)
    assert len(decision.delivery_days) == len(delivery.delivery_days) == 31


def test_forecast_published_after_cutoff_is_excluded():
    forecasts = forecast_frame(
        [
            ("2026-01-10T12:00Z", "2026-01-09T07:30Z", 5000),
            ("2026-01-10T12:00Z", "2026-01-09T09:30Z", 6000),  # latest before 10:00 cutoff
            ("2026-01-10T12:00Z", "2026-01-09T11:30Z", 9999),  # after cutoff: must be ignored
        ]
    )
    targets = build_targets([date(2026, 1, 10)], TEN)
    selected = select_latest_forecast(forecasts, targets).set_index("start_time")
    row = selected.loc[ts("2026-01-10T12:00Z")]
    assert row["forecast_mw"] == 6000
    assert row["publish_time"] == ts("2026-01-09T09:30Z")


def test_forecast_published_exactly_at_cutoff_is_eligible():
    forecasts = forecast_frame([("2026-01-10T12:00Z", "2026-01-09T10:00Z", 7000)])
    selected = select_latest_forecast(forecasts, build_targets([date(2026, 1, 10)], TEN))
    assert selected.loc[selected["start_time"] == ts("2026-01-10T12:00Z"), "forecast_mw"].item() == 7000


def test_no_eligible_forecast_is_unavailable_not_later_run():
    forecasts = forecast_frame([("2026-01-10T12:00Z", "2026-01-09T11:30Z", 9999)])
    selected = select_latest_forecast(forecasts, build_targets([date(2026, 1, 10)], TEN))
    row = selected[selected["start_time"] == ts("2026-01-10T12:00Z")].iloc[0]
    assert math.isnan(row["forecast_mw"])
    assert pd.isna(row["publish_time"])


def test_selection_is_per_hour():
    # Hour 23:00 is only covered by an older run; it must still be found.
    forecasts = forecast_frame(
        [
            ("2026-01-10T00:00Z", "2026-01-09T09:30Z", 100),
            ("2026-01-10T23:00Z", "2026-01-08T22:30Z", 200),
        ]
    )
    selected = select_latest_forecast(forecasts, build_targets([date(2026, 1, 10)], TEN)).set_index("start_time")
    assert selected.loc[ts("2026-01-10T00:00Z"), "forecast_mw"] == 100
    assert selected.loc[ts("2026-01-10T23:00Z"), "forecast_mw"] == 200


def test_build_comparison_matches_by_start_time_and_flags_status():
    forecasts = forecast_frame(
        [
            ("2026-01-10T00:00Z", "2026-01-09T09:30Z", 1000),
            ("2026-01-10T01:00Z", "2026-01-09T09:30Z", 1000),
        ]
    )
    actuals = actual_frame([("2026-01-10T00:00Z", 1200), ("2026-01-10T02:00Z", 900)])
    comp = build_comparison(forecasts, actuals, [date(2026, 1, 10)], TEN).set_index("start_time")

    h0 = comp.loc[ts("2026-01-10T00:00Z")]
    assert h0["status"] == "ok"
    assert h0["error_mw"] == -200  # under-forecast => negative
    assert h0["horizon_hours"] == pytest.approx(14.5)
    assert comp.loc[ts("2026-01-10T01:00Z"), "status"] == "missing_actual"
    assert comp.loc[ts("2026-01-10T02:00Z"), "status"] == "missing_forecast"
    assert comp.loc[ts("2026-01-10T03:00Z"), "status"] == "missing_both"
    assert len(comp) == 24


def test_forecast_evolution_flags_selected_and_later_runs():
    forecasts = forecast_frame(
        [
            ("2026-01-10T12:00Z", "2026-01-09T07:30Z", 5000),
            ("2026-01-10T12:00Z", "2026-01-09T09:30Z", 6000),
            ("2026-01-10T12:00Z", "2026-01-09T11:30Z", 6500),
            ("2026-01-10T12:00Z", "2026-01-10T13:00Z", 7000),  # after delivery: excluded
        ]
    )
    actuals = actual_frame([("2026-01-10T12:00Z", 6200)])
    evo = forecast_evolution(forecasts, actuals, ts("2026-01-10T12:00Z"), TEN)

    assert evo.selected_publish_time == ts("2026-01-09T09:30Z")
    assert evo.actual_mw == 6200
    assert list(evo.runs["is_selected"]) == [False, True, False]
    assert list(evo.runs["after_cutoff"]) == [False, False, True]
