"""
In-memory fixed-window rate limiting for credential endpoints.

Limits are counted per client address and bucket (e.g. "auth.login"). State lives
in process memory, which is enough to slow down credential stuffing against a
single instance; it is deliberately not a substitute for a shared store when the
API is scaled across many workers.
"""

from __future__ import annotations

import threading
import time
from typing import Dict, List, Tuple

from fastapi import HTTPException, Request, status

# (bucket, client key) -> timestamps of recent attempts inside the window
_hits: Dict[Tuple[str, str], List[float]] = {}
_lock = threading.Lock()

# Drop stored keys once the table grows past this size so a flood of unique
# client addresses cannot grow memory without bound.
_MAX_KEYS = 2000


def client_key(request: Request) -> str:
    """
    Best-effort client address for rate-limit bucketing.

    The rightmost ``X-Forwarded-For`` entry is the address appended by the closest
    proxy, so a client-supplied header cannot impersonate another address.
    Falls back to the direct peer address when no proxy header is present.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"


def hit(request: Request, bucket: str, limit: int, window_seconds: int) -> None:
    """
    Record an attempt and raise 429 when the bucket is exhausted.

    Args:
        request: Incoming request supplying the client address.
        bucket: Independent counter name (e.g. "auth.login").
        limit: Allowed attempts per window.
        window_seconds: Sliding window length in seconds.

    Raises:
        HTTPException: 429 Too Many Requests once ``limit`` attempts were made
            within ``window_seconds``.
    """
    key = (bucket, client_key(request))
    now = time.monotonic()
    with _lock:
        recent = [stamp for stamp in _hits.get(key, []) if now - stamp < window_seconds]
        if len(recent) >= limit:
            _hits[key] = recent
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a few minutes and try again.",
            )
        recent.append(now)
        if len(_hits) >= _MAX_KEYS:
            for stale in [k for k, stamps in _hits.items() if not any(now - s < window_seconds for s in stamps)]:
                _hits.pop(stale, None)
        _hits[key] = recent


def reset() -> None:
    """Clear every recorded attempt (used by tests and manual maintenance)."""
    with _lock:
        _hits.clear()


def rate_limit(bucket: str, limit: int, window_seconds: int):
    """Build a FastAPI dependency enforcing ``limit`` attempts per window."""

    def dependency(request: Request) -> None:
        hit(request, bucket, limit, window_seconds)

    return dependency
