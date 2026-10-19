"""Secret-based authentication dependency for private admin endpoints."""

import secrets

from fastapi import Header, HTTPException, status

from app.config import get_settings


async def require_admin_secret(
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> bool:
    """Validate admin authorization against configured server secret."""
    settings = get_settings()
    configured_secret = settings.admin_secret.strip()

    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin authentication is not configured on this server",
        )

    provided_secret: str | None = None
    if x_admin_secret:
        provided_secret = x_admin_secret.strip()
    elif authorization and authorization.lower().startswith("bearer "):
        provided_secret = authorization[7:].strip()

    if not provided_secret or not secrets.compare_digest(provided_secret, configured_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized admin access",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True
