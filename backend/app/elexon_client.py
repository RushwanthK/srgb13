"""Thin HTTP client for the two Elexon BMRS datasets used by the app.

All Elexon traffic goes through this module so timeouts, retries and error
translation live in one place.
"""

import logging
import time
from collections.abc import Callable
from datetime import date, datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ElexonUnavailable(Exception):
    """Raised when Elexon cannot be reached or returns an unusable response."""


def _iso_utc(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


class ElexonClient:
    def __init__(
        self,
        base_url: str,
        timeout_s: float = 30.0,
        max_retries: int = 3,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = httpx.Client(base_url=base_url, timeout=timeout_s, transport=transport)
        self._max_retries = max_retries
        self._sleep = sleep

    def fetch_wind_actuals(self, settlement_from: date, settlement_to: date) -> list[dict[str, Any]]:
        """FUELHH half-hourly outturn, filtered server-side to WIND."""
        return self._get(
            "/datasets/FUELHH/stream",
            {
                "settlementDateFrom": settlement_from.isoformat(),
                "settlementDateTo": settlement_to.isoformat(),
                "fuelType": "WIND",
            },
        )

    def fetch_wind_forecasts(self, publish_from: datetime, publish_to: datetime) -> list[dict[str, Any]]:
        """WINDFOR forecasts, every run (vintage) published in the window."""
        return self._get(
            "/datasets/WINDFOR/stream",
            {
                "publishDateTimeFrom": _iso_utc(publish_from),
                "publishDateTimeTo": _iso_utc(publish_to),
            },
        )

    def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        last_error = "unknown error"
        for attempt in range(self._max_retries + 1):
            try:
                response = self._client.get(path, params=params)
            except httpx.TransportError as exc:
                last_error = f"network error: {exc.__class__.__name__}"
            else:
                if response.status_code == 200:
                    return self._parse(response)
                last_error = f"HTTP {response.status_code}"
                if response.status_code not in RETRYABLE_STATUS:
                    break
            if attempt < self._max_retries:
                delay = 0.5 * 2**attempt
                logger.warning("Elexon %s failed (%s); retrying in %.1fs", path, last_error, delay)
                self._sleep(delay)
        raise ElexonUnavailable(f"Elexon request to {path} failed: {last_error}")

    @staticmethod
    def _parse(response: httpx.Response) -> list[dict[str, Any]]:
        try:
            body = response.json()
        except ValueError as exc:
            raise ElexonUnavailable("Elexon returned invalid JSON") from exc
        # /stream endpoints return a bare list; non-stream endpoints wrap it in {"data": [...]}.
        if isinstance(body, dict):
            body = body.get("data")
        if not isinstance(body, list):
            raise ElexonUnavailable("Unexpected Elexon response shape")
        return body
