"""Tests for GET /healthz endpoint (architecture 15.3, M5.1)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_ok(client: AsyncClient) -> None:
    """Verify /healthz returns 200 with ok status and environment."""
    response = await client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["environment"] == "test"
    assert data["database"] == "connected"
    assert data["budget_status"] == "ok"
    assert "timestamp" in data
