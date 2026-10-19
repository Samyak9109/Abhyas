"""User data correction and mistake reporting routes (FR-029)."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Company, Report
from app.schemas.report import ReportInput, ReportResponse
from app.security.challenge import verify_challenge
from app.security.rate_limit import rate_limit
from app.security.sanitizer import sanitize_text, validate_company_slug

router = APIRouter(prefix="/v1/reports", tags=["Reports"])


@router.post(
    "",
    response_model=ReportResponse,
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=600))],
)
async def submit_report(
    payload: ReportInput,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> ReportResponse:
    """Submit a report flagging incorrect or outdated company data (FR-029)."""
    clean_slug = validate_company_slug(payload.company_slug)
    client_ip = request.client.host if request.client else "127.0.0.1"

    # 1. Challenge verification
    await verify_challenge(payload.challenge_token, client_ip)

    # 2. Company existence check
    stmt = select(Company).where(Company.slug == clean_slug)
    company = (await db.execute(stmt)).scalar_one_or_none()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cannot report on non-existent company '{clean_slug}'",
        )

    # 3. Sanitize inputs (no prompt injection, no control characters)
    clean_reason = sanitize_text(payload.reason, max_length=1000)
    clean_field = sanitize_text(payload.field, max_length=100) if payload.field else None

    # 4. Create report record
    report = Report(
        company_slug=clean_slug,
        pack_id=payload.pack_id,
        field=clean_field,
        reason=clean_reason,
    )
    db.add(report)

    # 5. Lower pack confidence flag for review if company was ready (FR-029)
    if company.status == "ready" and company.coverage == "high":
        company.coverage = "medium"

    await db.commit()
    await db.refresh(report)

    return ReportResponse(
        status="reported",
        id=report.id,
        company_slug=clean_slug,
        message="Report received and queued for review",
        created_at=report.created_at,
    )
