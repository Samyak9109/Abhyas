"""Tests for POST /v1/reports endpoint (FR-029)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Report


@pytest.mark.asyncio
async def test_submit_report_success(client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify report submission creates record and lowers pack confidence flag for review."""
    company = Company(
        slug="salesforce",
        name="Salesforce",
        canonical_domain="salesforce.com",
        aliases=[],
        status="ready",
        coverage="high",
    )
    db_session.add(company)
    await db_session.commit()

    payload = {
        "company_slug": "salesforce",
        "field": "values",
        "reason": (
            "The core values listed do not include the newly published "
            "Trust and Sustainability pledge."
        ),
        "challenge_token": "test-turnstile-token",
    }
    resp = await client.post("/v1/reports", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "reported"
    assert data["company_slug"] == "salesforce"

    # Verify report in database
    stmt = select(Report).where(Report.company_slug == "salesforce")
    report = (await db_session.execute(stmt)).scalar_one_or_none()
    assert report is not None
    assert "Trust and Sustainability" in report.reason

    # Verify company coverage lowered for review (FR-029)
    await db_session.refresh(company)
    assert company.coverage == "medium"


@pytest.mark.asyncio
async def test_submit_report_non_existent_company(client: AsyncClient) -> None:
    """Verify reporting against non-existent company fails with 404."""
    payload = {
        "company_slug": "non-existent-corp",
        "reason": "This company has wrong data.",
        "challenge_token": "test-turnstile-token",
    }
    resp = await client.post("/v1/reports", json=payload)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_submit_report_short_reason_rejected(client: AsyncClient) -> None:
    """Verify validation enforces minimum reason length."""
    payload = {
        "company_slug": "google",
        "reason": "bad",  # Too short (< 5 chars)
        "challenge_token": "test-turnstile-token",
    }
    resp = await client.post("/v1/reports", json=payload)
    assert resp.status_code == 422
