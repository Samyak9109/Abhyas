"""Nightly static export of ready company packs and directory index (architecture 15.3)."""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Company, Pack


async def export_static_mirror(
    session: AsyncSession,
    output_dir: Path | str,
) -> dict[str, Any]:
    """Export all ready company packs and master index as static JSON.

    Ensures the web app continues functioning from static files or CDN
    even if the backend API or budget cap halts service (architecture 15.3).
    """
    out_path = Path(output_dir)
    packs_dir = out_path / "packs"
    packs_dir.mkdir(parents=True, exist_ok=True)

    # 1. Query all ready companies
    stmt = select(Company).where(Company.status == "ready").order_by(Company.name.asc())
    result = await session.execute(stmt)
    companies = result.scalars().all()

    index_items: list[dict[str, Any]] = []
    exported_count = 0
    now_iso = datetime.now(UTC).isoformat()

    for comp in companies:
        # Get latest pack
        pack_stmt = (
            select(Pack)
            .where(Pack.company_slug == comp.slug)
            .order_by(Pack.version.desc())
            .limit(1)
        )
        pack_result = await session.execute(pack_stmt)
        pack = pack_result.scalar_one_or_none()

        if pack and pack.json_data:
            # Write individual pack file: /packs/<slug>.json
            pack_file = packs_dir / f"{comp.slug}.json"
            pack_file.write_text(json.dumps(pack.json_data, indent=2), encoding="utf-8")
            exported_count += 1

            retrieved_str = (
                comp.last_researched_at.isoformat()
                if comp.last_researched_at
                else now_iso
            )
            index_items.append(
                {
                    "slug": comp.slug,
                    "name": comp.name,
                    "domain": comp.canonical_domain,
                    "aliases": comp.aliases or [],
                    "coverage": comp.coverage or "medium",
                    "status": "ready",
                    "retrievedAt": retrieved_str,
                    "ttlDays": pack.ttl_days or 30,
                }
            )

    # 2. Write master index file: /packs/index.json
    index_data = {
        "version": 1,
        "updatedAt": now_iso,
        "companies": index_items,
    }
    index_file = packs_dir / "index.json"
    index_file.write_text(json.dumps(index_data, indent=2), encoding="utf-8")

    return {
        "status": "success",
        "exported_packs": exported_count,
        "output_dir": str(out_path),
        "index_file": str(index_file),
    }
