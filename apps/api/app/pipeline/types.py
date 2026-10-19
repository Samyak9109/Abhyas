"""Data types and state representations for the bounded research graph (M5.2)."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class SourceDocument(BaseModel):
    """Cleaned source document collected by safe fetcher with provenance metadata."""

    url: str
    title: str
    retrieved_at: str
    source_type: str = "general"
    raw_html_length: int = 0
    cleaned_text: str = ""


class ResearchState(BaseModel):
    """Persistent execution state for a bounded research pipeline run (ADR-011)."""

    job_id: int
    company_slug: str
    company_name: str
    canonical_domain: str
    is_seed: bool = False
    current_step: str = "normalize_company"
    completed_steps: list[str] = Field(default_factory=list)
    status: Literal[
        "pending",
        "running",
        "queued",
        "ready",
        "insufficient_data",
        "failed",
        "interrupted_for_review",
    ] = "running"
    sources: list[SourceDocument] = Field(default_factory=list)
    extracted_data: dict[str, Any] = Field(default_factory=dict)
    validated_pack: dict[str, Any] | None = None
    coverage: Literal["high", "medium", "low"] | None = None
    tokens_used: int = 0
    cost_estimate_cents: float = 0.0
    error: str | None = None
