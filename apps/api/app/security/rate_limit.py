"""In-memory sliding window rate limiter without external cache dependencies (architecture 15.3)."""

import os
import time
from collections import deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Sliding-window in-memory rate limiter keyed by client identifier."""

    def __init__(self) -> None:
        self._history: dict[str, deque[float]] = {}
        self._last_cleanup: float = 0.0

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """Check if request is permitted under window. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - window_seconds

        # Periodic cleanup of expired entries across all keys to prevent unbounded memory growth
        if now - self._last_cleanup > 60 or len(self._history) > 1000:
            self.prune()

        queue = self._history.get(key)
        if queue is None:
            queue = deque()
            self._history[key] = queue

        # Evict expired entries
        while queue and queue[0] <= cutoff:
            queue.popleft()

        if len(queue) >= max_requests:
            oldest = queue[0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return False, retry_after

        queue.append(now)
        return True, 0

    def prune(self, max_age: float = 3600.0) -> int:
        """Evict keys that are empty or whose newest timestamp is older than max_age."""
        now = time.monotonic()
        self._last_cleanup = now
        stale_keys = [
            k for k, q in self._history.items()
            if not q or q[-1] <= (now - max_age)
        ]
        for k in stale_keys:
            del self._history[k]
        return len(stale_keys)

    def reset(self) -> None:
        """Clear all rate limit history (primarily for unit tests)."""
        self._history.clear()
        self._last_cleanup = 0.0


limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extract client IP, honoring X-Forwarded-For only when direct client is in TRUSTED_PROXIES."""
    direct_ip = request.client.host if request.client else "127.0.0.1"
    raw_trusted = os.environ.get("TRUSTED_PROXIES", "")
    if not raw_trusted:
        return direct_ip

    trusted = {ip.strip() for ip in raw_trusted.split(",") if ip.strip()}
    if direct_ip not in trusted:
        return direct_ip

    xff = request.headers.get("x-forwarded-for")
    if not xff:
        return direct_ip

    ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
    for ip in reversed(ips):
        if ip not in trusted:
            return ip
    return ips[0] if ips else direct_ip


def rate_limit(max_requests: int, window_seconds: int) -> Callable[[Request], None]:
    """FastAPI dependency for sliding-window rate limiting per client IP."""

    async def _rate_limit_dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        endpoint = request.url.path
        key = f"{client_ip}:{endpoint}"

        allowed, retry_after = limiter.is_allowed(
            key=key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

    return _rate_limit_dependency
