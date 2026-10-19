from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Service health response structure."""

    status: Literal["ok", "degraded"] = "ok"
    environment: str = Field(..., description="Active server runtime environment")
    database: Literal["connected", "disconnected"] = "connected"
    budget_status: Literal["ok", "warning", "exceeded"] = "ok"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
