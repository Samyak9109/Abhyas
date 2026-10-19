"""Research queue prioritizer and job dispatcher (M5.3, ADR-010, architecture 15.3)."""

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.models import Company, ResearchJob, ResearchRequest
from app.pipeline.budget import BudgetManager
from app.pipeline.graph import ResearchPipeline
from app.pipeline.types import ResearchState


class QueueManager:
    """Manages demand queue prioritization, job dispatching, and cooldowns."""

    def __init__(
        self,
        settings: Settings | None = None,
        budget_manager: BudgetManager | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.budget_manager = budget_manager or BudgetManager(self.settings)

    async def get_queued_companies(
        self,
        session: AsyncSession,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Return queued companies ordered by distinct demand (DESC), then age (ASC)."""
        window_start = date.today() - timedelta(days=self.settings.demand_window_days)

        # 1. Fetch companies with status='queued'
        stmt = select(Company).where(Company.status == "queued")
        queued_companies = (await session.execute(stmt)).scalars().all()

        if not queued_companies:
            return []

        # 2. Compute demand count and oldest request per queued company
        queue_items: list[dict[str, Any]] = []
        for company in queued_companies:
            req_stmt = select(
                func.count(func.distinct(ResearchRequest.client_hash)).label("distinct_count"),
                func.coalesce(func.min(ResearchRequest.day), date.today()).label("oldest_day"),
            ).where(
                ResearchRequest.company_slug == company.slug,
                ResearchRequest.day >= window_start,
            )
            res = (await session.execute(req_stmt)).one()
            distinct_count = res.distinct_count or 0
            oldest_day = res.oldest_day or date.today()

            queue_items.append(
                {
                    "slug": company.slug,
                    "name": company.name,
                    "domain": company.canonical_domain,
                    "distinct_requests": distinct_count,
                    "oldest_request_day": oldest_day.isoformat(),
                    "company_obj": company,
                }
            )

        # 3. Sort by distinct_requests DESC, then oldest_request_day ASC (age)
        queue_items.sort(
            key=lambda x: (-x["distinct_requests"], x["oldest_request_day"]),
        )

        return queue_items[:limit]

    async def get_next_eligible_company(
        self,
        session: AsyncSession,
    ) -> tuple[Company | None, int]:
        """Fetch the highest priority queued company ready for research."""
        queued = await self.get_queued_companies(session, limit=1)
        if not queued:
            return None, 0
        top = queued[0]
        return top["company_obj"], top["distinct_requests"]

    async def dispatch_job(
        self,
        session: AsyncSession,
        company_slug: str,
        mock_pages: dict[str, str] | None = None,
        mock_extracted_pack: dict[str, Any] | None = None,
        resume: bool = True,
    ) -> tuple[str, str | None, ResearchState | None]:
        """Dispatch and execute a research job respecting budget caps and kill switch."""
        # 1. Verify budget and kill switch before running
        can_run, reason = await self.budget_manager.can_start_job(session)
        if not can_run:
            # Mark company as queued if not already
            c_stmt = select(Company).where(Company.slug == company_slug)
            company = (await session.execute(c_stmt)).scalar_one_or_none()
            if company and company.status != "queued":
                company.status = "queued"
                await session.commit()
            return "blocked", reason, None

        # 2. Check cooldowns (insufficient data 30-day cooldown)
        c_stmt = select(Company).where(Company.slug == company_slug)
        company = (await session.execute(c_stmt)).scalar_one_or_none()
        if not company:
            return "error", f"Company '{company_slug}' not found", None

        now = datetime.now(UTC)
        if company.status == "insufficient_data" and company.last_researched_at:
            researched = (
                company.last_researched_at.replace(tzinfo=UTC)
                if company.last_researched_at.tzinfo is None
                else company.last_researched_at
            )
            cooldown = timedelta(days=self.settings.insufficient_data_cooldown_days)
            if now - researched < cooldown:
                return (
                    "cooldown",
                    f"Company '{company_slug}' marked insufficient_data within 30 days",
                    None,
                )

        # 3. Create or find active research job
        job_stmt = select(ResearchJob).where(
            ResearchJob.company_slug == company_slug,
            ResearchJob.status.in_(["pending", "running"]),
        )
        job = (await session.execute(job_stmt)).scalar_one_or_none()
        if not job:
            job = ResearchJob(
                company_slug=company_slug,
                status="running",
                started_at=now,
            )
            session.add(job)
        else:
            job.status = "running"
            job.started_at = now

        company.status = "researching"
        await session.commit()
        await session.refresh(job)

        # 4. Run through bounded research pipeline
        pipeline = ResearchPipeline(session=session)
        state = await pipeline.execute(
            job_id=job.id,
            company_slug=company_slug,
            mock_pages=mock_pages,
            mock_extracted_pack=mock_extracted_pack,
            resume=resume,
        )

        # 5. Update job and company records based on pipeline execution outcome
        job.tokens_used = state.tokens_used
        job.cost_estimate = state.cost_cents
        job.error = state.error

        if state.status == "ready":
            job.status = "completed"
            company.status = "ready"
            company.coverage = state.coverage_score
            company.last_researched_at = now
        elif state.status == "insufficient_data":
            job.status = "completed"
            company.status = "insufficient_data"
            company.coverage = "insufficient_data"
            company.last_researched_at = now
        elif state.status == "queued":
            # Halted at budget guard
            job.status = "pending"
            company.status = "queued"
        else:
            job.status = state.status
            company.status = state.status

        await session.commit()
        return state.status, state.error, state

    async def dispatch_queue(
        self,
        session: AsyncSession,
        max_jobs: int = 5,
        mock_pages_by_slug: dict[str, dict[str, str]] | None = None,
        mock_extracted_by_slug: dict[str, dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Dispatch queued jobs sequentially up to max_jobs or until budget cap halts."""
        results: list[dict[str, Any]] = []

        for _ in range(max_jobs):
            company, count = await self.get_next_eligible_company(session)
            if not company:
                break

            slug = company.slug
            mock_pages = mock_pages_by_slug.get(slug) if mock_pages_by_slug else None
            mock_extracted = mock_extracted_by_slug.get(slug) if mock_extracted_by_slug else None

            status_result, error, state = await self.dispatch_job(
                session=session,
                company_slug=slug,
                mock_pages=mock_pages,
                mock_extracted_pack=mock_extracted,
            )

            results.append(
                {
                    "slug": slug,
                    "distinct_requests": count,
                    "status": status_result,
                    "error": error,
                    "tokens_used": state.tokens_used if state else 0,
                    "cost_cents": state.cost_cents if state else 0.0,
                }
            )

            # Halt immediately if budget cap or kill switch blocked execution
            if status_result == "blocked":
                break

        return results
