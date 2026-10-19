"""Pre-seeded companies registry and offline research management (M5.3, architecture 15.3)."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company

# 12 Hand-reviewed seed employers (matches packages/content/packs/ seed catalog)
SEED_COMPANIES: list[dict[str, Any]] = [
    {
        "slug": "google",
        "name": "Google",
        "canonical_domain": "about.google",
        "aliases": ["Alphabet", "Google LLC"],
    },
    {
        "slug": "amazon",
        "name": "Amazon",
        "canonical_domain": "aboutamazon.com",
        "aliases": ["Amazon.com", "AWS"],
    },
    {
        "slug": "microsoft",
        "name": "Microsoft",
        "canonical_domain": "microsoft.com",
        "aliases": ["MSFT"],
    },
    {
        "slug": "meta",
        "name": "Meta",
        "canonical_domain": "about.meta.com",
        "aliases": ["Facebook", "Meta Platforms"],
    },
    {
        "slug": "apple",
        "name": "Apple",
        "canonical_domain": "apple.com",
        "aliases": ["Apple Inc."],
    },
    {
        "slug": "netflix",
        "name": "Netflix",
        "canonical_domain": "about.netflix.com",
        "aliases": ["Netflix Inc."],
    },
    {
        "slug": "stripe",
        "name": "Stripe",
        "canonical_domain": "stripe.com",
        "aliases": ["Stripe Inc."],
    },
    {
        "slug": "uber",
        "name": "Uber",
        "canonical_domain": "uber.com",
        "aliases": ["Uber Technologies"],
    },
    {
        "slug": "airbnb",
        "name": "Airbnb",
        "canonical_domain": "airbnb.com",
        "aliases": ["Airbnb Inc."],
    },
    {
        "slug": "spotify",
        "name": "Spotify",
        "canonical_domain": "spotify.com",
        "aliases": ["Spotify Technology"],
    },
    {
        "slug": "github",
        "name": "GitHub",
        "canonical_domain": "github.com",
        "aliases": ["GitHub Inc."],
    },
    {
        "slug": "salesforce",
        "name": "Salesforce",
        "canonical_domain": "salesforce.com",
        "aliases": ["Salesforce, Inc."],
    },
]

_SEED_SLUGS = {c["slug"] for c in SEED_COMPANIES}


class SeedManager:
    """Manages pre-seeded employer list and baseline database population."""

    @classmethod
    def is_seed_company(cls, slug: str) -> bool:
        """Return True if slug is in the curated seed list."""
        return slug in _SEED_SLUGS

    @classmethod
    def get_seed_company(cls, slug: str) -> dict[str, Any] | None:
        """Find seed company metadata by slug."""
        for c in SEED_COMPANIES:
            if c["slug"] == slug:
                return dict(c)
        return None

    @classmethod
    def list_seed_companies(cls) -> list[dict[str, Any]]:
        """Return all curated seed company definitions."""
        return [dict(c) for c in SEED_COMPANIES]

    @classmethod
    async def initialize_seed_companies(cls, session: AsyncSession) -> int:
        """Populate database with seed company placeholders if missing."""
        seeded_count = 0
        for entry in SEED_COMPANIES:
            slug = entry["slug"]
            stmt = select(Company).where(Company.slug == slug)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                company = Company(
                    slug=slug,
                    name=entry["name"],
                    canonical_domain=entry["canonical_domain"],
                    aliases=entry["aliases"],
                    status="ready",
                    coverage="high",
                )
                session.add(company)
                seeded_count += 1

        if seeded_count > 0:
            await session.commit()

        return seeded_count
