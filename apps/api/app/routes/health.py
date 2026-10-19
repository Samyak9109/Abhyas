"""Health check endpoint (architecture 15.3)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.database import get_db
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/healthz", response_model=HealthResponse)
async def get_health(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> HealthResponse:
    """Return runtime health status and database connectivity."""
    db_status = "connected"
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    status = "ok" if db_status == "connected" else "degraded"

    return HealthResponse(
        status=status,
        environment=settings.environment,
        database=db_status,
        budget_status="ok",
        timestamp=datetime.now(UTC),
    )
