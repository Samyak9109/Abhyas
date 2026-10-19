"""Tests for company listing, pack retrieval, and demand requests (FR-026, ADR-010)."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Pack, ResearchJob


@pytest.mark.asyncio
async def test_list_companies_empty(client: AsyncClient) -> None:
    """Verify /v1/companies returns an empty list initially with caching headers."""
    response = await client.get("/v1/companies")
    assert response.status_code == 200
    assert response.json() == []
    assert "public, max-age=60" in response.headers.get("Cache-Control", "")


@pytest.mark.asyncio
async def test_list_companies_search(client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify autocomplete filtering by query string."""
    c1 = Company(
        slug="google",
        name="Google",
        canonical_domain="google.com",
        aliases=["alphabet"],
        status="ready",
        coverage="high",
    )
    c2 = Company(
        slug="stripe",
        name="Stripe",
        canonical_domain="stripe.com",
        aliases=["stripe payments"],
        status="requested",
    )
    db_session.add_all([c1, c2])
    await db_session.commit()

    # Search for "strip"
    resp = await client.get("/v1/companies?q=strip")
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["slug"] == "stripe"

    # Search for all
    resp_all = await client.get("/v1/companies")
    assert resp_all.status_code == 200
    assert len(resp_all.json()) == 2


@pytest.mark.asyncio
async def test_get_company_not_found(client: AsyncClient) -> None:
    """Verify 404 for unregistered company slug."""
    response = await client.get("/v1/companies/unknown-corp")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_company_with_pack(client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify /v1/companies/{slug} returns company details and full pack payload when ready."""
    now = datetime.now(UTC)
    c = Company(
        slug="netflix",
        name="Netflix",
        canonical_domain="netflix.com",
        aliases=["nflx"],
        status="ready",
        coverage="high",
        last_researched_at=now,
    )
    db_session.add(c)
    await db_session.flush()

    pack_data = {
        "slug": "netflix",
        "name": "Netflix",
        "domain": "netflix.com",
        "overview": {"summary": "Streaming service"},
    }
    pack = Pack(
        company_slug="netflix",
        version=1,
        json_data=pack_data,
        retrieved_at=now,
        ttl_days=30,
    )
    db_session.add(pack)
    await db_session.commit()

    response = await client.get("/v1/companies/netflix")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "netflix"
    assert data["status"] == "ready"
    assert data["pack"]["overview"]["summary"] == "Streaming service"
    assert "public, max-age=300" in response.headers.get("Cache-Control", "")


@pytest.mark.asyncio
async def test_get_company_detects_stale_pack(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Verify company status transitions to 'stale' when pack exceeds TTL."""
    expired_date = datetime.now(UTC) - timedelta(days=35)
    c = Company(
        slug="uber",
        name="Uber",
        canonical_domain="uber.com",
        aliases=[],
        status="ready",
        coverage="high",
        last_researched_at=expired_date,
    )
    db_session.add(c)
    await db_session.flush()

    pack = Pack(
        company_slug="uber",
        version=1,
        json_data={"slug": "uber", "name": "Uber"},
        retrieved_at=expired_date,
        ttl_days=30,
    )
    db_session.add(pack)
    await db_session.commit()

    response = await client.get("/v1/companies/uber")
    assert response.status_code == 200
    assert response.json()["status"] == "stale"


@pytest.mark.asyncio
async def test_register_demand_and_queue_transition(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Verify demand counting deduplicates requests and moves company to 'queued' at threshold."""
    slug = "hashicorp"

    # Register 4 distinct client tokens (threshold is 5)
    for i in range(1, 5):
        payload = {
            "domain": "hashicorp.com",
            "client_token": f"client-token-{i}",
            "challenge_token": "test-turnstile-token",
        }
        resp = await client.post(f"/v1/companies/{slug}/request", json=payload)
        assert resp.status_code == 200
        assert resp.json()["status"] == "requested"

    # 5th distinct client request meets demand threshold (ADR-010)
    payload_5 = {
        "domain": "hashicorp.com",
        "client_token": "client-token-5",
        "challenge_token": "test-turnstile-token",
    }
    resp_5 = await client.post(f"/v1/companies/{slug}/request", json=payload_5)
    assert resp_5.status_code == 200
    assert resp_5.json()["status"] == "queued"

    # Verify a pending ResearchJob was created
    company = await db_session.get(Company, slug)
    assert company is not None
    assert company.status == "queued"

    from sqlalchemy import select

    jobs = (
        (await db_session.execute(select(ResearchJob).where(ResearchJob.company_slug == slug)))
        .scalars()
        .all()
    )
    assert len(jobs) == 1
    assert jobs[0].status == "pending"


@pytest.mark.asyncio
async def test_register_demand_invalid_slug(client: AsyncClient) -> None:
    """Verify invalid company slugs are rejected with 400 Bad Request."""
    payload = {"challenge_token": "test-turnstile-token"}
    resp = await client.post("/v1/companies/INVALID_SLUG!/request", json=payload)
    assert resp.status_code == 400
