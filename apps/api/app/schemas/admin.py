"""Pydantic schemas for private admin management endpoints."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class AdminSeedInput(BaseModel):
    """Seed pack or company insertion payload."""

    slug: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    canonical_domain: str = Field(..., min_length=1, max_length=255)
    aliases: list[str] = Field(default_factory=list)
    coverage: Literal["high", "medium", "low"] = "high"
    ttl_days: int = Field(default=30, ge=1)
    pack_json: dict[str, Any] = Field(..., description="Evidenced company pack JSON object")


class AdminRollbackInput(BaseModel):
    """Rollback request payload."""

    company_slug: str = Field(..., min_length=1, max_length=100)
    target_version: int | None = Field(
        default=None,
        description="Target pack version to restore. If omitted, rolls back to previous version.",
    )


class AdminRunJobInput(BaseModel):
    """Manual job execution trigger payload."""

    company_slug: str = Field(..., min_length=1, max_length=100)
    force: bool = Field(default=False, description="Bypass budget guard or demand threshold")


class AdminOperationResponse(BaseModel):
    """Generic status response for admin actions."""

    status: str
    company_slug: str
    message: str
    details: dict[str, Any] | None = None


class AdminKillSwitchInput(BaseModel):
    """Payload to toggle the research service emergency kill-switch."""

    active: bool = Field(..., description="True to halt all research jobs immediately")


class AdminDispatchQueueInput(BaseModel):
    """Payload to trigger batch dispatch of queued research jobs."""

    max_jobs: int = Field(default=5, ge=1, le=20, description="Max jobs to process in this run")


class AdminBudgetSummaryResponse(BaseModel):
    """Overview of daily/monthly spend against caps, alerts, and kill-switch status (M5.5)."""

    daily_spent_cents: float
    monthly_spent_cents: float
    daily_budget_cents: int
    monthly_budget_cents: int
    daily_alert_level: str = "ok"
    monthly_alert_level: str = "ok"
    active_alerts: list[str] = Field(default_factory=list)
    kill_switch_active: bool
    queued_companies_count: int
    running_jobs_count: int


class AdminDrillAlertInput(BaseModel):
    """Payload to trigger a budget alert drill (M5.5 acceptance criteria)."""

    percentage: int = Field(..., ge=1, le=200, description="Simulated percentage of budget (e.g. 50, 80, 100)")
    scope: Literal["daily", "monthly"] = Field(default="daily", description="Budget scope to evaluate")


class AdminDrillAlertResponse(BaseModel):
    """Result of budget alert drill simulation."""

    alert_fired: bool
    level: str
    scope: str
    simulated_percentage: int
    simulated_spent_cents: float
    cap_cents: int
    message: str


class AdminResolveReportInput(BaseModel):
    """Payload to resolve an inaccuracy report."""

    resolution: str = Field(default="resolved", description="Status (e.g. resolved, dismissed)")
    notes: str | None = Field(default=None, description="Operator notes regarding resolution")

