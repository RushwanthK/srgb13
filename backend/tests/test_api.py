"""Route-level smoke tests using a fake Elexon client (no network)."""

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.elexon_client import ElexonUnavailable
from app.main import app
from app.routes.deps import get_service
from app.services.cache import TTLCache
from app.services.data_service import WindDataService


class FakeClient:
    """Constant 1000 MW actuals; forecasts published 09:30 and 11:30 on D-1."""

    def fetch_wind_actuals(self, settlement_from, settlement_to):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        return [
            {"startTime": (start + timedelta(minutes=30 * i)).isoformat(), "publishTime": None, "fuelType": "WIND", "generation": 1000}
            for i in range(48 * 33)
        ]

    def fetch_wind_forecasts(self, publish_from, publish_to):
        rows = []
        for day_offset in range(33):
            day = datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_offset)
            for hour in range(24):
                start = (day + timedelta(hours=hour)).isoformat()
                rows.append({"startTime": start, "publishTime": (day - timedelta(hours=14, minutes=30)).isoformat(), "generation": 1100})
                rows.append({"startTime": start, "publishTime": (day - timedelta(hours=12, minutes=30)).isoformat(), "generation": 5000})
        return rows


class FailingClient:
    def fetch_wind_actuals(self, *args):
        raise ElexonUnavailable("HTTP 503")

    fetch_wind_forecasts = fetch_wind_actuals


@pytest.fixture
def client():
    app.dependency_overrides[get_service] = lambda: WindDataService(FakeClient(), TTLCache(60))
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client):
    assert client.get("/api/v1/health").json() == {"status": "ok"}


def test_overview_uses_forecast_before_cutoff(client):
    body = client.get("/api/v1/overview", params={"scope": "decision", "cutoff": "10:00"}).json()
    assert body["scope"]["delivery_from"] == "2026-01-02"
    # 09:30 run (1100) is selected; the 11:30 run (5000) is after the cutoff.
    assert body["kpis"]["bias_mw"] == pytest.approx(100)
    assert body["kpis"]["coverage_pct"] == pytest.approx(100)


def test_later_cutoff_picks_later_run(client):
    body = client.get("/api/v1/accuracy", params={"cutoff": "12:00"}).json()
    assert body["kpis"]["bias_mw"] == pytest.approx(4000)
    assert len(body["by_hour"]) == 24


def test_forecasts_day_includes_band(client):
    body = client.get("/api/v1/forecasts", params={"date": "2026-01-10"}).json()
    assert len(body["rows"]) == 24
    assert body["rows"][0]["band_low_mw"] is not None
    assert body["cutoff_time"] == "2026-01-09T10:00:00Z"
    assert body["band_min_history_days"] == 5
    assert body["band_coverage_pct"] == pytest.approx(100)  # constant error => always inside
    assert body["band_hours_evaluated"] > 0


def test_forecasts_early_day_has_no_band(client):
    body = client.get("/api/v1/forecasts", params={"date": "2026-01-03"}).json()
    assert all(r["band_low_mw"] is None for r in body["rows"])


def test_forecasts_rejects_day_outside_scope(client):
    r = client.get("/api/v1/forecasts", params={"date": "2026-01-01", "scope": "decision"})
    assert r.status_code == 404


def test_invalid_cutoff_is_422(client):
    assert client.get("/api/v1/overview", params={"cutoff": "25:00"}).status_code == 422


def test_evolution(client):
    body = client.get("/api/v1/forecasts/evolution", params={"start_time": "2026-01-10T12:00:00Z"}).json()
    assert len(body["runs"]) == 2
    assert body["selected_forecast_mw"] == 1100
    assert [r["after_cutoff"] for r in body["runs"]] == [False, True]


def test_upstream_failure_is_503():
    app.dependency_overrides[get_service] = lambda: WindDataService(FailingClient(), TTLCache(60))
    try:
        r = TestClient(app).get("/api/v1/overview")
        assert r.status_code == 503
        assert "unavailable" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()
