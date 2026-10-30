from datetime import date, datetime, timezone

import httpx
import pytest

from app.elexon_client import ElexonClient, ElexonUnavailable

BASE = "https://example.test/bmrs/api/v1"


def make_client(handler, retries: int = 2) -> tuple[ElexonClient, list[float]]:
    sleeps: list[float] = []
    client = ElexonClient(BASE, max_retries=retries, transport=httpx.MockTransport(handler), sleep=sleeps.append)
    return client, sleeps


def test_fetch_actuals_sends_wind_filter_and_parses_list():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["path"] = request.url.path
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[{"startTime": "2026-01-10T10:00:00Z", "generation": 1}])

    client, _ = make_client(handler)
    rows = client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 2))
    assert rows == [{"startTime": "2026-01-10T10:00:00Z", "generation": 1}]
    assert seen["path"].endswith("/datasets/FUELHH/stream")
    assert seen["params"] == {"settlementDateFrom": "2026-01-01", "settlementDateTo": "2026-01-02", "fuelType": "WIND"}


def test_fetch_forecasts_uses_publish_window_and_accepts_data_wrapper():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json={"data": [{"generation": 5}]})

    client, _ = make_client(handler)
    rows = client.fetch_wind_forecasts(
        datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 1, 2, 12, tzinfo=timezone.utc)
    )
    assert rows == [{"generation": 5}]
    assert seen["params"] == {"publishDateTimeFrom": "2026-01-01T00:00:00Z", "publishDateTimeTo": "2026-01-02T12:00:00Z"}


def test_retries_on_5xx_then_succeeds():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 3 else httpx.Response(200, json=[])

    client, sleeps = make_client(handler, retries=3)
    assert client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1)) == []
    assert calls["n"] == 3
    assert sleeps == [0.5, 1.0]


def test_gives_up_after_retries():
    client, sleeps = make_client(lambda r: httpx.Response(500), retries=2)
    with pytest.raises(ElexonUnavailable, match="HTTP 500"):
        client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1))
    assert len(sleeps) == 2


def test_client_error_is_not_retried():
    client, sleeps = make_client(lambda r: httpx.Response(400))
    with pytest.raises(ElexonUnavailable, match="HTTP 400"):
        client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1))
    assert sleeps == []


def test_network_error_is_retried_then_raised():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    client, sleeps = make_client(handler, retries=1)
    with pytest.raises(ElexonUnavailable, match="network error"):
        client.fetch_wind_actuals(date(2026, 1, 1), date(2026, 1, 1))
    assert len(sleeps) == 1
