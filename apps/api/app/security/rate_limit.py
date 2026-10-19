"""In-memory sliding window rate limiter without external cache dependencies (architecture 15.3)."""

import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Sliding-window in-memory rate limiter keyed by client identifier."""

    def __init__(self) -> None:
        self._history: dict[str, deque[float]] = defaultdict(deque)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """Check if request is permitted under window. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - window_seconds
        queue = self._history[key]

        # Evict expired entries
        while queue and queue[0] <= cutoff:
            queue.popleft()

        if len(queue) >= max_requests:
            oldest = queue[0]
            retry_after = max(1, int(oldest + window_seconds - now))
            return False, retry_after

        queue.append(now)
        return True, 0

    def reset(self) -> None:
        """Clear all rate limit history (primarily for unit tests)."""
        self._history.clear()


limiter = SlidingWindowRateLimiter()


def rate_limit(max_requests: int, window_seconds: int) -> Callable[[Request], None]:
    """FastAPI dependency for sliding-window rate limiting per client IP."""

    async def _rate_limit_dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
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
