"""Bounded 11-node research graph pipeline orchestrator (architecture 15.3, ADR-011)."""

from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Company, Pack, ResearchJob
from app.pipeline.budget import BudgetManager
from app.pipeline.checkpointer import Checkpointer
from app.pipeline.extractor import ResearchExtractor
from app.pipeline.fetcher import SafeFetcher
from app.pipeline.types import ResearchState, SourceDocument
from app.pipeline.validator import PipelineValidator
from app.security.sanitizer import validate_company_slug


class ResearchPipeline:
    """Bounded, resumable execution graph for company pack research (FR-026, ADR-011)."""

    def __init__(
        self,
        session: AsyncSession,
        fetcher: SafeFetcher | None = None,
        budget_manager: BudgetManager | None = None,
    ) -> None:
        self.session = session
        self.fetcher = fetcher or SafeFetcher()
        self.settings = get_settings()
        self.budget_manager = budget_manager or BudgetManager(self.settings)

    async def execute(
        self,
        job_id: int,
        company_slug: str,
        is_seed: bool = False,
        mock_pages: dict[str, str] | None = None,
        mock_extracted_pack: dict[str, Any] | None = None,
        resume: bool = True,
    ) -> ResearchState:
        """Run or resume the bounded research graph."""
        # 1. Check for existing checkpoint if resume is True
        state: ResearchState | None = None
        if resume:
            state = await Checkpointer.load_checkpoint(self.session, job_id)

        if not state:
            state = ResearchState(
                job_id=job_id,
                company_slug=company_slug,
                company_name=company_slug.replace("-", " ").title(),
                canonical_domain=f"{company_slug}.com",
                is_seed=is_seed,
                status="running",
            )

        # -------------------------------------------------------------
        # Node 1: normalize_company
        # -------------------------------------------------------------
        if "normalize_company" not in state.completed_steps:
            clean_slug = validate_company_slug(state.company_slug)
            state.company_slug = clean_slug
            stmt = select(Company).where(Company.slug == clean_slug)
            company = (await self.session.execute(stmt)).scalar_one_or_none()
            if company:
                state.company_name = company.name
                state.canonical_domain = company.canonical_domain

            state.completed_steps.append("normalize_company")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 2: check_cache
        # -------------------------------------------------------------
        if "check_cache" not in state.completed_steps:
            pack_stmt = (
                select(Pack)
                .where(Pack.company_slug == state.company_slug)
                .order_by(Pack.version.desc())
                .limit(1)
            )
            latest_pack = (await self.session.execute(pack_stmt)).scalar_one_or_none()
            if latest_pack:
                now = datetime.now(UTC)
                retrieved = (
                    latest_pack.retrieved_at.replace(tzinfo=UTC)
                    if latest_pack.retrieved_at.tzinfo is None
                    else latest_pack.retrieved_at
                )
                if now - retrieved < timedelta(days=latest_pack.ttl_days):
                    # Fresh pack in cache -> END
                    state.status = "ready"
                    state.validated_pack = latest_pack.json_data
                    state.completed_steps.append("check_cache")
                    await Checkpointer.save_checkpoint(self.session, state)
                    return state

            state.completed_steps.append("check_cache")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 3: budget_guard
        # -------------------------------------------------------------
        if "budget_guard" not in state.completed_steps:
            can_run, block_reason = await self.budget_manager.can_start_job(self.session)
            if not can_run:
                # Over cap or kill switch active -> mark queued and exit
                state.status = "queued"
                state.error = block_reason or "Budget cap exceeded; queued for next window"
                stmt = select(Company).where(Company.slug == state.company_slug)
                c = (await self.session.execute(stmt)).scalar_one_or_none()
                if c:
                    c.status = "queued"
                    await self.session.commit()

                state.completed_steps.append("budget_guard")
                await Checkpointer.save_checkpoint(self.session, state)
                return state

            state.completed_steps.append("budget_guard")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 4: discover_sources
        # -------------------------------------------------------------
        if "discover_sources" not in state.completed_steps:
            domain = state.canonical_domain
            discovered_urls = [
                f"https://{domain}",
                f"https://{domain}/about",
                f"https://{domain}/careers",
                f"https://{domain}/values",
            ]
            if mock_pages:
                # In test fixture mode, discover all mock URLs
                discovered_urls = list(mock_pages.keys())

            state.extracted_data["discovered_urls"] = discovered_urls
            state.completed_steps.append("discover_sources")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 5: fetch_and_clean
        # -------------------------------------------------------------
        if "fetch_and_clean" not in state.completed_steps:
            discovered = state.extracted_data.get("discovered_urls", [])
            page_limit = self.settings.max_pages_per_job
            for url in discovered[:page_limit]:  # Per-job page limit (architecture 15.3)
                try:
                    mock_content = mock_pages.get(url) if mock_pages else None
                    title, cleaned_text = await self.fetcher.fetch_page(
                        url=url,
                        expected_domain=state.canonical_domain if not mock_pages else None,
                        mock_response=mock_content,
                    )
                    state.sources.append(
                        SourceDocument(
                            url=url,
                            title=title,
                            retrieved_at=datetime.now(UTC).isoformat(),
                            raw_html_length=len(mock_content)
                            if mock_content
                            else len(cleaned_text),
                            cleaned_text=cleaned_text,
                        )
                    )
                except (httpx.HTTPError, ValueError):
                    # Non-fatal fetch failure per-node policy (network or validation)
                    continue

            state.completed_steps.append("fetch_and_clean")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 6: extract_fields
        # -------------------------------------------------------------
        if "extract_fields" not in state.completed_steps:
            raw_pack, tokens, cost = await ResearchExtractor.extract_from_documents(
                slug=state.company_slug,
                company_name=state.company_name,
                domain=state.canonical_domain,
                sources=state.sources,
                mock_output=mock_extracted_pack,
            )
            state.extracted_data["raw_pack"] = raw_pack
            state.tokens_used += tokens
            state.cost_estimate_cents += cost
            state.completed_steps.append("extract_fields")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 7: merge_validate
        # -------------------------------------------------------------
        if "merge_validate" not in state.completed_steps:
            raw_pack = state.extracted_data.get("raw_pack", {})
            validated, _ = PipelineValidator.validate_and_filter_sections(
                raw_pack=raw_pack,
                verified_sources=state.sources,
            )
            state.validated_pack = validated
            state.completed_steps.append("merge_validate")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 8: injection_scan
        # -------------------------------------------------------------
        if "injection_scan" not in state.completed_steps:
            if state.validated_pack:
                for section in ("overview", "products", "techStack", "values", "interviewProcess"):
                    if (
                        section in state.validated_pack
                        and "summary" in state.validated_pack[section]
                    ):
                        summary = state.validated_pack[section]["summary"]
                        clean_summary, _ = PipelineValidator.scan_and_sanitize_injection(summary)
                        state.validated_pack[section]["summary"] = clean_summary

            state.completed_steps.append("injection_scan")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 9: score_coverage
        # -------------------------------------------------------------
        if "score_coverage" not in state.completed_steps:
            coverage, status = PipelineValidator.score_coverage(state.validated_pack or {})
            state.coverage = coverage

            if status == "insufficient_data":
                state.status = "insufficient_data"
                state.error = "Insufficient public evidenced data"
                stmt = select(Company).where(Company.slug == state.company_slug)
                company = (await self.session.execute(stmt)).scalar_one_or_none()
                if company:
                    company.status = "insufficient_data"
                    await self.session.commit()

                state.completed_steps.append("score_coverage")
                await Checkpointer.save_checkpoint(self.session, state)
                return state

            state.completed_steps.append("score_coverage")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 10: owner_review_interrupt (seeds only)
        # -------------------------------------------------------------
        if "owner_review_interrupt" not in state.completed_steps:
            if state.is_seed:
                state.status = "interrupted_for_review"
                state.completed_steps.append("owner_review_interrupt")
                await Checkpointer.save_checkpoint(self.session, state)
                return state

            state.completed_steps.append("owner_review_interrupt")
            await Checkpointer.save_checkpoint(self.session, state)

        # -------------------------------------------------------------
        # Node 11: persist_pack
        # -------------------------------------------------------------
        if "persist_pack" not in state.completed_steps:
            now = datetime.now(UTC)

            # 1. Update company record
            c_stmt = select(Company).where(Company.slug == state.company_slug)
            company = (await self.session.execute(c_stmt)).scalar_one_or_none()
            if not company:
                company = Company(
                    slug=state.company_slug,
                    name=state.company_name,
                    canonical_domain=state.canonical_domain,
                    aliases=[],
                    status="ready",
                    coverage=state.coverage,
                    last_researched_at=now,
                )
                self.session.add(company)
            else:
                company.status = "ready"
                company.coverage = state.coverage
                company.last_researched_at = now

            # 2. Add versioned pack record
            v_stmt = select(func.coalesce(func.max(Pack.version), 0)).where(
                Pack.company_slug == state.company_slug
            )
            current_v = (await self.session.execute(v_stmt)).scalar() or 0
            new_pack = Pack(
                company_slug=state.company_slug,
                version=current_v + 1,
                json_data=state.validated_pack or {},
                retrieved_at=now,
                ttl_days=self.settings.pack_default_ttl_days,
            )
            self.session.add(new_pack)

            # 3. Complete research job
            job_stmt = select(ResearchJob).where(ResearchJob.id == state.job_id)
            job = (await self.session.execute(job_stmt)).scalar_one_or_none()
            if job:
                job.status = "completed"
                job.finished_at = now
                job.tokens_used = state.tokens_used
                job.cost_estimate = state.cost_estimate_cents

            await self.session.commit()

            state.status = "ready"
            state.completed_steps.append("persist_pack")
            await Checkpointer.save_checkpoint(self.session, state)

        return state
