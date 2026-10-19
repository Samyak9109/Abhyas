"""Private admin routes for seeding packs, rollback, and management (architecture 15.3)."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.database import get_db
from app.db.models import Company, Pack, Report, ResearchJob
from app.pipeline.budget import BudgetManager
from app.pipeline.export import export_static_mirror
from app.pipeline.queue import QueueManager
from app.pipeline.seed import SeedManager
from app.schemas.admin import (
    AdminBudgetSummaryResponse,
    AdminDispatchQueueInput,
    AdminDrillAlertInput,
    AdminDrillAlertResponse,
    AdminKillSwitchInput,
    AdminOperationResponse,
    AdminResolveReportInput,
    AdminRollbackInput,
    AdminRunJobInput,
    AdminSeedInput,
)
from app.security.admin_auth import require_admin_secret
from app.security.sanitizer import validate_company_slug

router = APIRouter(
    prefix="/v1/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin_secret)],
)


@router.post("/seed", response_model=AdminOperationResponse)
async def seed_company_pack(
    payload: AdminSeedInput,
    db: AsyncSession = Depends(get_db),
) -> AdminOperationResponse:
    """Seed or update an evidenced company pack (admin operation)."""
    clean_slug = validate_company_slug(payload.slug)
    now = datetime.now(UTC)

    # Lookup or create company
    company_stmt = select(Company).where(Company.slug == clean_slug)
    company = (await db.execute(company_stmt)).scalar_one_or_none()

    if not company:
        company = Company(
            slug=clean_slug,
            name=payload.name,
            canonical_domain=payload.canonical_domain.lower().strip(),
            aliases=payload.aliases,
            status="ready",
            coverage=payload.coverage,
            last_researched_at=now,
        )
        db.add(company)
        await db.flush()
    else:
        company.name = payload.name
        company.canonical_domain = payload.canonical_domain.lower().strip()
        company.aliases = payload.aliases
        company.status = "ready"
        company.coverage = payload.coverage
        company.last_researched_at = now

    # Determine next pack version
    version_stmt = select(func.coalesce(func.max(Pack.version), 0)).where(
        Pack.company_slug == clean_slug
    )
    max_version = (await db.execute(version_stmt)).scalar() or 0
    next_version = max_version + 1

    new_pack = Pack(
        company_slug=clean_slug,
        version=next_version,
        json_data=payload.pack_json,
        retrieved_at=now,
        ttl_days=payload.ttl_days,
    )
    db.add(new_pack)
    await db.commit()

    return AdminOperationResponse(
        status="success",
        company_slug=clean_slug,
        message=f"Seeded pack v{next_version} for {clean_slug}",
        details={"version": next_version, "status": "ready", "coverage": payload.coverage},
    )


@router.post("/rollback", response_model=AdminOperationResponse)
async def rollback_company_pack(
    payload: AdminRollbackInput,
    db: AsyncSession = Depends(get_db),
) -> AdminOperationResponse:
    """Roll back a company pack to a target or previous version."""
    clean_slug = validate_company_slug(payload.company_slug)

    # Check company
    company_stmt = select(Company).where(Company.slug == clean_slug)
    company = (await db.execute(company_stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company '{clean_slug}' not found",
        )

    # Check available packs
    packs_stmt = select(Pack).where(Pack.company_slug == clean_slug).order_by(Pack.version.desc())
    packs = (await db.execute(packs_stmt)).scalars().all()

    if len(packs) <= 1 and payload.target_version is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot rollback: company '{clean_slug}' has only {len(packs)} pack version",
        )

    if payload.target_version is not None:
        target_pack = next((p for p in packs if p.version == payload.target_version), None)
        if not target_pack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target version v{payload.target_version} not found for '{clean_slug}'",
            )
        # Delete versions newer than target
        for p in packs:
            if p.version > payload.target_version:
                await db.delete(p)
        active_version = payload.target_version
    else:
        # Delete newest version to restore previous
        newest = packs[0]
        await db.delete(newest)
        active_version = packs[1].version

    company.status = "ready"
    company.last_researched_at = datetime.now(UTC)
    await db.commit()

    return AdminOperationResponse(
        status="success",
        company_slug=clean_slug,
        message=f"Rolled back to pack v{active_version}",
        details={"active_version": active_version},
    )


@router.post("/run-job", response_model=AdminOperationResponse)
async def trigger_research_job(
    payload: AdminRunJobInput,
    db: AsyncSession = Depends(get_db),
) -> AdminOperationResponse:
    """Trigger research pipeline execution for a company (M5.1 skeleton)."""
    clean_slug = validate_company_slug(payload.company_slug)

    company_stmt = select(Company).where(Company.slug == clean_slug)
    company = (await db.execute(company_stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company '{clean_slug}' not found",
        )

    company.status = "researching"
    job = ResearchJob(company_slug=clean_slug, status="running")
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return AdminOperationResponse(
        status="dispatched",
        company_slug=clean_slug,
        message="Research job initiated",
        details={"job_id": job.id, "status": "running"},
    )


@router.get("/reports", response_model=list[dict[str, Any]])
async def list_reports(
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List outstanding data correction reports for operator review (FR-029, M5.5)."""
    stmt = select(Report).order_by(Report.created_at.desc()).limit(100)
    reports = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": r.id,
            "company_slug": r.company_slug,
            "pack_id": r.pack_id,
            "field": r.field,
            "reason": r.reason,
            "status": r.status,
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in reports
    ]


@router.post("/reports/{report_id}/resolve", response_model=AdminOperationResponse)
async def resolve_report(
    report_id: int,
    payload: AdminResolveReportInput,
    db: AsyncSession = Depends(get_db),
) -> AdminOperationResponse:
    """Mark an inaccuracy report as resolved or dismissed (M5.5)."""
    stmt = select(Report).where(Report.id == report_id)
    report = (await db.execute(stmt)).scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} not found",
        )
    report.status = payload.resolution
    report.resolved_at = datetime.now(UTC)
    await db.commit()
    return AdminOperationResponse(
        status="success",
        company_slug=report.company_slug,
        message=f"Report {report_id} marked as {payload.resolution}",
        details={
            "report_id": report_id,
            "resolution": payload.resolution,
            "notes": payload.notes,
        },
    )


@router.get("/budget", response_model=AdminBudgetSummaryResponse)
async def get_budget_summary(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AdminBudgetSummaryResponse:
    """Return current spending vs daily/monthly caps, alerts (50/80/100%), and kill-switch status (M5.5)."""
    budget_mgr = BudgetManager(settings)
    alert_info = await budget_mgr.get_budget_alerts(db)
    is_killed = BudgetManager.is_kill_switch_active(settings)

    # Count queued companies and running jobs
    queued_stmt = select(func.count()).select_from(Company).where(Company.status == "queued")
    queued_count = (await db.execute(queued_stmt)).scalar() or 0
    running_jobs = (
        await db.execute(
            select(func.count()).select_from(ResearchJob).where(ResearchJob.status == "running")
        )
    ).scalar() or 0

    return AdminBudgetSummaryResponse(
        daily_spent_cents=round(alert_info["daily_spent_cents"], 2),
        monthly_spent_cents=round(alert_info["monthly_spent_cents"], 2),
        daily_budget_cents=settings.daily_budget_cents,
        monthly_budget_cents=settings.monthly_budget_cents,
        daily_alert_level=alert_info["daily_level"],
        monthly_alert_level=alert_info["monthly_level"],
        active_alerts=alert_info["active_alerts"],
        kill_switch_active=is_killed,
        queued_companies_count=queued_count,
        running_jobs_count=running_jobs,
    )


@router.post("/alerts/drill", response_model=AdminDrillAlertResponse)
async def drill_budget_alert(
    payload: AdminDrillAlertInput,
    settings: Settings = Depends(get_settings),
) -> AdminDrillAlertResponse:
    """Trigger a drill simulation for budget alerts at 50, 80, 100% (M5.5 acceptance criteria)."""
    budget_mgr = BudgetManager(settings)
    res = budget_mgr.drill_budget_alert(payload.percentage, payload.scope)
    return AdminDrillAlertResponse(**res)


@router.get("/logs", response_model=list[dict[str, Any]])
async def list_job_logs(
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return recent research job execution logs and status history for ops review (M5.5)."""
    stmt = select(ResearchJob).order_by(ResearchJob.started_at.desc()).limit(limit)
    jobs = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": j.id,
            "company_slug": j.company_slug,
            "status": j.status,
            "started_at": j.started_at.isoformat(),
            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
            "tokens_used": j.tokens_used,
            "cost_estimate_cents": j.cost_estimate,
            "error": j.error,
        }
        for j in jobs
    ]



@router.post("/kill-switch", response_model=AdminOperationResponse)
async def set_kill_switch(
    payload: AdminKillSwitchInput,
) -> AdminOperationResponse:
    """Emergency toggle to halt or resume research pipeline jobs immediately."""
    BudgetManager.set_kill_switch(payload.active)
    state_str = "ACTIVE (paused)" if payload.active else "INACTIVE (resumed)"
    return AdminOperationResponse(
        status="success",
        company_slug="*",
        message=f"Research service kill switch set to {state_str}",
        details={"kill_switch_active": payload.active},
    )


@router.get("/queue", response_model=list[dict[str, Any]])
async def list_queued_companies(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[dict[str, Any]]:
    """Return prioritized queue of companies awaiting research."""
    queue_mgr = QueueManager(settings)
    items = await queue_mgr.get_queued_companies(db, limit=50)
    # Strip SQLAlchemy object from JSON response
    return [
        {
            "slug": item["slug"],
            "name": item["name"],
            "domain": item["domain"],
            "distinct_requests": item["distinct_requests"],
            "oldest_request_day": item["oldest_request_day"],
        }
        for item in items
    ]


@router.post("/queue/dispatch", response_model=list[dict[str, Any]])
async def dispatch_research_queue(
    payload: AdminDispatchQueueInput,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[dict[str, Any]]:
    """Trigger sequential dispatch of highest-priority queued companies."""
    queue_mgr = QueueManager(settings)
    return await queue_mgr.dispatch_queue(db, max_jobs=payload.max_jobs)


@router.post("/seed-all", response_model=AdminOperationResponse)
async def seed_all_companies(
    db: AsyncSession = Depends(get_db),
) -> AdminOperationResponse:
    """Pre-seed database with all 12 hand-reviewed reference companies."""
    seeded_count = await SeedManager.initialize_seed_companies(db)
    return AdminOperationResponse(
        status="success",
        company_slug="*",
        message=f"Initialized {seeded_count} pre-seeded company records",
        details={
            "seeded_count": seeded_count,
            "catalog_size": len(SeedManager.list_seed_companies()),
        },
    )


@router.post("/export", response_model=AdminOperationResponse)
async def export_mirror(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AdminOperationResponse:
    """Trigger static JSON mirror export of all ready company packs and index (architecture 15.3)."""
    result = await export_static_mirror(db, settings.static_mirror_dir)
    return AdminOperationResponse(
        status="success",
        company_slug="*",
        message=f"Exported {result['exported_packs']} ready company packs to static mirror",
        details=result,
    )

