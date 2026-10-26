"""Cloudflare Turnstile challenge token verification (FR-026, ADR-009)."""

import httpx
from fastapi import HTTPException, status

from app.config import get_settings


async def verify_challenge(token: str, remote_ip: str | None = None) -> bool:
    """Verify Turnstile token against Cloudflare API or test bypass."""
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing anti-bot challenge token",
        )

    settings = get_settings()

    # Development and test bypass
    if settings.environment in ("test", "development"):
        if token == "test-turnstile-token" or not settings.turnstile_secret_key:
            return True

    if not settings.turnstile_secret_key:
        # If no secret key is configured, allow in non-production
        if settings.environment != "production":
            return True
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Challenge verification misconfigured",
        )

    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    payload = {
        "secret": settings.turnstile_secret_key,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, data=payload)
            data = resp.json()
            if data.get("success", False):
                return True
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Challenge verification service unreachable",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid anti-bot challenge token",
    )
