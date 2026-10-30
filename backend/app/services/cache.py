"""Minimal in-memory TTL cache.

On serverless hosts each instance keeps its own cache, so a cold start
re-fetches from Elexon. That is an accepted trade-off for this pilot.
"""

import threading
import time
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


class TTLCache:
    def __init__(self, ttl_s: float, clock: Callable[[], float] = time.monotonic) -> None:
        self._ttl_s = ttl_s
        self._clock = clock
        self._store: dict[Any, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get_or_set(self, key: Any, factory: Callable[[], T]) -> T:
        # One lock for everything: simple, and it prevents concurrent requests
        # from triggering duplicate Elexon downloads.
        with self._lock:
            hit = self._store.get(key)
            if hit is not None and self._clock() - hit[0] < self._ttl_s:
                return hit[1]
            value = factory()
            self._store[key] = (self._clock(), value)
            return value

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
