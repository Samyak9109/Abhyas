"""Pydantic schemas for company resources and research demand requests."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

CompanyStatus = Literal[
    "ready",
    "stale",
    "requested",
    "queued",
    "researching",
    "insufficient_data",
    "unknown",
]


class CompanySummary(BaseModel):
    """Compact summary of a company's research state."""

    slug: str
    name: str
    domain: str
    aliases: list[str] = Field(default_factory=list)
    status: CompanyStatus
    coverage: Literal["high", "medium", "low"] | None = None
    last_researched_at: datetime | None = None


class CompanyDetailResponse(BaseModel):
    """Complete company status payload and optional pack data."""

    slug: str
    name: str
    domain: str
    aliases: list[str] = Field(default_factory=list)
    status: CompanyStatus
    coverage: Literal["high", "medium", "low"] | None = None
    last_researched_at: datetime | None = None
    pack: dict[str, Any] | None = None


class CompanyRequestInput(BaseModel):
    """Demand registration payload from candidate clients (FR-026, ADR-010)."""

    domain: str | None = Field(
        default=None,
        description="Optional domain hint, e.g. 'stripe.com'",
        max_length=255,
    )
    client_token: str | None = Field(
        default=None,
        description="Client-generated random salt token for demand deduplication",
        max_length=64,
    )
    challenge_token: str = Field(
        ...,
        description="Cloudflare Turnstile verification token",
        min_length=1,
    )

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cleaned = v.strip().lower()
        if not cleaned:
            return None
        if "/" in cleaned or "@" in cleaned or ":" in cleaned:
            raise ValueError("Domain must be a valid hostname without protocol, path, or port")
        return cleaned


class CompanyRequestResponse(BaseModel):
    """Response returned upon demand registration."""

    status: CompanyStatus
    slug: str
    message: str = "Demand registered"
