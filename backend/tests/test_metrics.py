import math
from datetime import date

import pandas as pd
import pytest

from app.services import metrics
from factories import comparison_frame


def test_mae_rmse_bias_hand_computed():
    # errors: +100, -300, +200
    comp = comparison_frame([(1100, 1000), (700, 1000), (1200, 1000)])
    k = metrics.compute_kpis(comp)
    assert k["mae_mw"] == pytest.approx(200)
    assert k["rmse_mw"] == pytest.approx(math.sqrt((100**2 + 300**2 + 200**2) / 3))
    assert k["bias_mw"] == pytest.approx(0)


def test_negative_bias_means_under_forecast():
    comp = comparison_frame([(800, 1000), (900, 1000)])
    assert metrics.compute_kpis(comp)["bias_mw"] == pytest.approx(-150)


def test_mape_excludes_zero_actuals_and_reports_count():
    comp = comparison_frame([(110, 100), (50, 0), (90, 100)])
    k = metrics.compute_kpis(comp)
    assert k["mape_pct"] == pytest.approx(10)
    assert k["mape_excluded"] == 1


def test_mape_none_when_all_actuals_zero():
    value, excluded = metrics.mape(*_series([(10, 0), (5, 0)]))
    assert value is None and excluded == 2


def test_wape():
    comp = comparison_frame([(110, 100), (50, 0), (90, 100)])
    # sum|err| = 10 + 50 + 10 = 70 ; sum|A| = 200
    assert metrics.compute_kpis(comp)["wape_pct"] == pytest.approx(35)


def test_missing_records_are_excluded_and_counted():
    comp = comparison_frame([(1000, 900), (None, 900), (1000, None), (None, None)])
    k = metrics.compute_kpis(comp)
    assert k["n_expected"] == 4
    assert k["n_matched"] == 1
    assert k["n_missing_forecast"] == 2
    assert k["n_missing_actual"] == 2
    assert k["coverage_pct"] == pytest.approx(25)
    assert k["mae_mw"] == pytest.approx(100)


def test_empty_metrics_are_none_not_zero():
    k = metrics.compute_kpis(comparison_frame([(None, 100)]))
    assert k["n_matched"] == 0
    assert k["mae_mw"] is None and k["rmse_mw"] is None and k["bias_mw"] is None


def test_error_by_hour_returns_24_buckets():
    result = metrics.error_by_hour(comparison_frame([(1100, 1000)] * 24))
    assert [r["hour"] for r in result] == list(range(24))
    assert all(r["mae_mw"] == pytest.approx(100) for r in result)


def test_histogram_counts_all_pairs():
    comp = comparison_frame([(1100, 1000), (700, 1000), (1200, 1000), (None, 1)])
    bins = metrics.error_histogram(comp, bin_width_mw=100)
    assert sum(b["count"] for b in bins) == 3


def _days(n: int, start: str = "2026-01-01", error: float = 0.0, actual: float = 1000.0) -> pd.DataFrame:
    """n consecutive 24-hour days with a constant forecast error."""
    start_day = pd.Timestamp(start)
    return pd.concat(
        [
            comparison_frame([(actual + error, actual)] * 24, day=(start_day + pd.Timedelta(days=i)).strftime("%Y-%m-%d"))
            for i in range(n)
        ],
        ignore_index=True,
    )


def test_error_band_uses_only_days_up_to_d_minus_2():
    past = _days(5, start="2026-01-01", error=500)  # 1-5 Jan: known at the 7 Jan decision
    d_minus_1 = _days(1, start="2026-01-06", error=-9000)  # not yet known at the cutoff
    target = _days(1, start="2026-01-07")
    future = _days(5, start="2026-01-08", error=-9000)  # must never be used
    comp = pd.concat([past, d_minus_1, target, future], ignore_index=True)

    band = metrics.add_error_band(comp, date(2026, 1, 7))
    # actual = forecast - error, and the only usable error is +500
    assert (band["band_low_mw"] == 500).all()
    assert (band["band_high_mw"] == 500).all()


def test_error_band_empty_without_enough_history():
    comp = pd.concat([_days(4, start="2026-01-01", error=100), _days(1, start="2026-01-06")], ignore_index=True)
    band = metrics.add_error_band(comp, date(2026, 1, 6))
    assert band["band_low_mw"].isna().all() and band["band_high_mw"].isna().all()


def test_band_coverage_backtest():
    # Constant error history => zero-width band that always contains the actual
    comp = _days(10, error=200)
    result = metrics.band_coverage(comp, [date(2026, 1, d) for d in range(1, 11)])
    # Bands exist for 7-10 Jan only (each needs >= 5 days on or before D-2)
    assert result["band_hours_evaluated"] == 4 * 24
    assert result["band_coverage_pct"] == pytest.approx(100)


def _series(pairs):
    comp = comparison_frame(pairs)
    return comp["forecast_mw"], comp["actual_mw"]
