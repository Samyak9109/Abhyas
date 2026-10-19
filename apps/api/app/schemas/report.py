"""Pydantic schemas for flagging incorrect or outdated company data (FR-029)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ReportInput(BaseModel):
    """Payload to report incorrect or outdated company data."""

    company_slug: str = Field(..., min_length=1, max_length=100)
    pack_id: int | None = Field(default=None, description="Optional pack version ID")
    field: str | None = Field(
        default=None,
        description="Target field name, e.g. 'overview', 'techStack', 'values'",
        max_length=100,
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=1000,
        description="Explanation of the issue or correction reference",
    )
    challenge_token: str = Field(
        ...,
        min_length=1,
        description="Cloudflare Turnstile verification token",
    )


class ReportResponse(BaseModel):
    """Response returned upon report creation."""

    status: Literal["reported"] = "reported"
    id: int
    company_slug: str
    message: str = "Report received and queued for review"
    created_at: datetime
