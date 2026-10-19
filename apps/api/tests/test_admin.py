"""Tests for private admin management endpoints (architecture 15.3)."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Pack


@pytest.mark.asyncio
async def test_admin_requires_authentication(client: AsyncClient) -> None:
    """Verify admin endpoints reject unauthorized callers with 401."""
    resp = await client.post("/v1/admin/seed", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_seed_and_versioning(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Verify admin seed creates company and versioned pack records."""
    headers = {"X-Admin-Secret": "test-admin-secret"}
    payload = {
        "slug": "anthropic",
        "name": "Anthropic",
        "canonical_domain": "anthropic.com",
        "aliases": ["claude"],
        "coverage": "high",
        "ttl_days": 45,
        "pack_json": {
            "slug": "anthropic",
            "name": "Anthropic",
            "domain": "anthropic.com",
            "overview": {"summary": "AI safety and research company"},
        },
    }

    resp = await client.post("/v1/admin/seed", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["details"]["version"] == 1

    # Seed version 2 with updated pack
    payload["pack_json"]["overview"]["summary"] = "Updated summary v2"
    resp_v2 = await client.post("/v1/admin/seed", json=payload, headers=headers)
    assert resp_v2.status_code == 200
    assert resp_v2.json()["details"]["version"] == 2

    # Verify both packs exist in database
    packs = (
        (
            await db_session.execute(
                select(Pack).where(Pack.company_slug == "anthropic").order_by(Pack.version.asc())
            )
        )
        .scalars()
        .all()
    )
    assert len(packs) == 2
    assert packs[0].version == 1
    assert packs[1].version == 2


@pytest.mark.asyncio
async def test_admin_rollback(client: AsyncClient, db_session: AsyncSession) -> None:
    """Verify admin rollback removes newer pack version and restores previous."""
    headers = {"Authorization": "Bearer test-admin-secret"}

    # Seed v1 and v2
    company = Company(
        slug="figma",
        name="Figma",
        canonical_domain="figma.com",
        aliases=[],
        status="ready",
    )
    p1 = Pack(company_slug="figma", version=1, json_data={"v": 1}, ttl_days=30)
    p2 = Pack(company_slug="figma", version=2, json_data={"v": 2}, ttl_days=30)
    db_session.add_all([company, p1, p2])
    await db_session.commit()

    rollback_payload = {"company_slug": "figma"}
    resp = await client.post("/v1/admin/rollback", json=rollback_payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["details"]["active_version"] == 1

    # Verify v2 was removed
    packs = (
        (
            await db_session.execute(
                select(Pack).where(Pack.company_slug == "figma").order_by(Pack.version.asc())
            )
        )
        .scalars()
        .all()
    )
    assert len(packs) == 1
    assert packs[0].version == 1
