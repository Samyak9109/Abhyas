"""Research pipeline package for bounded, demand-gated company pack generation (M5.2)."""

from app.pipeline.graph import ResearchPipeline
from app.pipeline.types import ResearchState

__all__ = ["ResearchPipeline", "ResearchState"]
