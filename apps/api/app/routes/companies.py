"""Public company pack retrieval and demand registration routes (FR-026, ADR-009, ADR-010)."""

import hashlib
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.database import get_db
from app.db.models import Company, Pack, ResearchJob, ResearchRequest
from app.pipeline.budget import BudgetManager
from app.schemas.company import (
    CompanyDetailResponse,
    CompanyRequestInput,
    CompanyRequestResponse,
    CompanySummary,
)
from app.security.challenge import verify_challenge
from app.security.rate_limit import rate_limit
from app.security.sanitizer import validate_company_slug

router = APIRouter(prefix="/v1/companies", tags=["Companies"])


def _calculate_effective_status(
    company_status: str,
    retrieved_at: datetime | None,
    ttl_days: int,
) -> str:
    """Return 'stale' if pack exists and exceeded its TTL (architecture 15.3)."""
    if company_status != "ready" or not retrieved_at:
        return company_status

    now = datetime.now(UTC)
    if retrieved_at.tzinfo is None:
        retrieved_at = retrieved_at.replace(tzinfo=UTC)

    if now - retrieved_at > timedelta(days=ttl_days):
        return "stale"
    return "ready"


@router.get("", response_model=list[CompanySummary])
async def list_companies(
    response: Response,
    q: str = Query(default="", max_length=100, description="Search query string"),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[CompanySummary]:
    """Autocomplete and status search endpoint for company packs (Cacheable)."""
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=300"

    stmt = select(Company)
    clean_q = q.strip().lower()
    if clean_q:
        stmt = stmt.where(
            func.lower(Company.name).contains(clean_q)
            | func.lower(Company.slug).contains(clean_q)
            | func.lower(Company.canonical_domain).contains(clean_q)
        )
    stmt = stmt.order_by(Company.name.asc()).limit(50)

    result = await db.execute(stmt)
    companies = result.scalars().all()

    summaries: list[CompanySummary] = []
    for c in companies:
        effective_status = _calculate_effective_status(
            c.status,
            c.last_researched_at,
            settings.pack_default_ttl_days,
        )
        summaries.append(
            CompanySummary(
                slug=c.slug,
                name=c.name,
                domain=c.canonical_domain,
                aliases=c.aliases or [],
                status=effective_status,  # type: ignore[arg-type]
                coverage=c.coverage,  # type: ignore[arg-type]
                last_researched_at=c.last_researched_at,
            )
        )
    return summaries


@router.get("/{slug}", response_model=CompanyDetailResponse)
async def get_company(
    slug: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CompanyDetailResponse:
    """Fetch company pack payload or current research status (CDN-cacheable)."""
    clean_slug = validate_company_slug(slug)

    stmt = select(Company).where(Company.slug == clean_slug)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company '{clean_slug}' not found",
        )

    # Fetch latest pack if available
    pack_stmt = (
        select(Pack).where(Pack.company_slug == clean_slug).order_by(Pack.version.desc()).limit(1)
    )
    pack_result = await db.execute(pack_stmt)
    latest_pack = pack_result.scalar_one_or_none()

    effective_status = _calculate_effective_status(
        company.status,
        latest_pack.retrieved_at if latest_pack else company.last_researched_at,
        latest_pack.ttl_days if latest_pack else settings.pack_default_ttl_days,
    )

    if effective_status in ("ready", "stale"):
        response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600"
    else:
        response.headers["Cache-Control"] = "no-cache"

    return CompanyDetailResponse(
        slug=company.slug,
        name=company.name,
        domain=company.canonical_domain,
        aliases=company.aliases or [],
        status=effective_status,  # type: ignore[arg-type]
        coverage=company.coverage,  # type: ignore[arg-type]
        last_researched_at=company.last_researched_at,
        pack=latest_pack.json_data if latest_pack else None,
    )


@router.post(
    "/{slug}/request",
    response_model=CompanyRequestResponse,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=600))],
)
async def register_company_demand(
    slug: str,
    payload: CompanyRequestInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CompanyRequestResponse:
    """Register user demand for a company pack (FR-026, ADR-010)."""
    clean_slug = validate_company_slug(slug)
    client_ip = request.client.host if request.client else "127.0.0.1"

    # 1. Challenge verification
    await verify_challenge(payload.challenge_token, client_ip)

    # 2. Lookup or create company record
    stmt = select(Company).where(Company.slug == clean_slug)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()

    if not company:
        derived_domain = payload.domain or f"{clean_slug}.com"
        derived_name = clean_slug.replace("-", " ").title()
        company = Company(
            slug=clean_slug,
            name=derived_name,
            canonical_domain=derived_domain,
            aliases=[],
            status="requested",
        )
        db.add(company)
        await db.flush()

    # Check status cooldowns (architecture 15.3, ADR-010)
    now = datetime.now(UTC)
    if company.status == "ready":
        return CompanyRequestResponse(
            status="ready",
            slug=clean_slug,
            message="Company pack is already ready",
        )

    if company.status == "insufficient_data" and company.last_researched_at:
        researched = (
            company.last_researched_at.replace(tzinfo=UTC)
            if company.last_researched_at.tzinfo is None
            else company.last_researched_at
        )
        if now - researched < timedelta(days=settings.insufficient_data_cooldown_days):
            return CompanyRequestResponse(
                status="insufficient_data",
                slug=clean_slug,
                message=(
                    f"Insufficient data found within {settings.insufficient_data_cooldown_days} "
                    "days; retry cooldown active"
                ),
            )

    if company.status == "stale" and company.last_researched_at:
        researched = (
            company.last_researched_at.replace(tzinfo=UTC)
            if company.last_researched_at.tzinfo is None
            else company.last_researched_at
        )
        if now - researched < timedelta(days=settings.stale_cooldown_days):
            return CompanyRequestResponse(
                status="stale",
                slug=clean_slug,
                message=f"Refresh cooldown active ({settings.stale_cooldown_days} days)",
            )

    # 3. Create deduplicated request record (hashed IP + daily salt + client token)
    today = datetime.now(UTC).date()
    salt = f"abhyas-salt-{today.isoformat()}"
    client_raw = f"{client_ip}:{payload.client_token or ''}:{salt}"
    client_hash = hashlib.sha256(client_raw.encode("utf-8")).hexdigest()

    req_check = select(ResearchRequest).where(
        ResearchRequest.company_slug == clean_slug,
        ResearchRequest.day == today,
        ResearchRequest.client_hash == client_hash,
    )
    existing_req = (await db.execute(req_check)).scalar_one_or_none()

    if not existing_req:
        new_request = ResearchRequest(
            company_slug=clean_slug,
            day=today,
            client_hash=client_hash,
        )
        db.add(new_request)
        await db.flush()

    # 4. Count distinct requests in the demand window
    window_start = today - timedelta(days=settings.demand_window_days)
    count_stmt = select(func.count(func.distinct(ResearchRequest.client_hash))).where(
        ResearchRequest.company_slug == clean_slug,
        ResearchRequest.day >= window_start,
    )
    distinct_count = (await db.execute(count_stmt)).scalar() or 0

    # 5. Transition to queued if demand threshold met, collapsing duplicates to existing job
    is_paused = BudgetManager.is_kill_switch_active(settings)
    if distinct_count >= settings.demand_threshold and not is_paused:
        if company.status in ("unknown", "requested", "stale"):
            company.status = "queued"

        # Collapse duplicate requests to a single pending/running job (architecture 15.3)
        job_check = select(ResearchJob).where(
            ResearchJob.company_slug == clean_slug,
            ResearchJob.status.in_(["pending", "running"]),
        )
        existing_job = (await db.execute(job_check)).scalar_one_or_none()
        if not existing_job:
            job = ResearchJob(company_slug=clean_slug, status="pending")
            db.add(job)

    await db.commit()

    resp_message = "Demand registered successfully"
    if is_paused:
        resp_message = "Demand registered; research service is currently paused"
    elif company.status in ("queued", "researching"):
        resp_message = f"Demand registered; company is currently {company.status}"

    return CompanyRequestResponse(
        status=company.status,  # type: ignore[arg-type]
        slug=clean_slug,
        message=resp_message,
    )
