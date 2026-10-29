"""Job state checkpointing for resumable research graph execution (ADR-011)."""

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ResearchJob
from app.pipeline.types import ResearchState


class Checkpointer:
    """Manages serialization, storage, and resumption of research graph execution states."""

    @classmethod
    async def save_checkpoint(
        cls,
        session: AsyncSession,
        state: ResearchState,
    ) -> None:
        """Persist current state checkpoint to database."""
        stmt = select(ResearchJob).where(ResearchJob.id == state.job_id)
        job = (await session.execute(stmt)).scalar_one_or_none()
        if job:
            job.tokens_used = state.tokens_used
            job.cost_estimate = state.cost_estimate_cents
            job.status = state.status
            job.checkpoint_data = state.model_dump()
            await session.commit()

    @classmethod
    async def load_checkpoint(
        cls,
        session: AsyncSession,
        job_id: int,
    ) -> ResearchState | None:
        """Load state checkpoint from database if available."""
        stmt = select(ResearchJob).where(ResearchJob.id == job_id)
        job = (await session.execute(stmt)).scalar_one_or_none()
        if job and job.checkpoint_data:
            try:
                return ResearchState.model_validate(job.checkpoint_data)
            except ValidationError:
                return None
        return None
