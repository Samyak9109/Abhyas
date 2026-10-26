"""Evidence validation, prompt injection scanning, and coverage scoring (AI-019, AI-021)."""

import re
from typing import Any, Literal

from app.pipeline.types import SourceDocument

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(?:all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(?:all\s+)?prior\s+prompts", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(?:a|an)\s+", re.IGNORECASE),
    re.compile(r"system\s*prompt\s*:", re.IGNORECASE),
    re.compile(r"<\s*script\s*>", re.IGNORECASE),
    re.compile(r"---\s*(?:END|SYSTEM|RULES|ASSISTANT)", re.IGNORECASE),
]

EVIDENCED_SECTIONS = [
    "overview",
    "products",
    "techStack",
    "values",
    "interviewProcess",
    "cultureSignals",
]


class PipelineValidator:
    """Validates evidenced fields, strips prompt injections, and calculates coverage."""

    @staticmethod
    def scan_and_sanitize_injection(text: str) -> tuple[str, bool]:
        """Scan text for prompt injection attempts and sanitize delimiter breakouts."""
        detected = False
        cleaned = text

        for pattern in INJECTION_PATTERNS:
            if pattern.search(cleaned):
                detected = True
                cleaned = pattern.sub("[REDACTED_UNTRUSTED_CONTENT]", cleaned)

        # Neutralize markdown and delimiter breakout attempts
        cleaned = cleaned.replace("```", "'''")
        cleaned = cleaned.replace("---", "—")
        return cleaned.strip(), detected

    @classmethod
    def validate_and_filter_sections(
        cls,
        raw_pack: dict[str, Any],
        verified_sources: list[SourceDocument],
    ) -> tuple[dict[str, Any], list[str]]:
        """Validate evidence contracts on all sections; drop unevidenced fields (arch 15.3)."""
        valid_urls = {s.url for s in verified_sources}
        cleaned_pack: dict[str, Any] = {
            "slug": raw_pack.get("slug", ""),
            "name": raw_pack.get("name", ""),
            "domain": raw_pack.get("domain", ""),
            "aliases": raw_pack.get("aliases", []),
        }
        dropped_sections: list[str] = []

        for section_name in EVIDENCED_SECTIONS:
            section_data = raw_pack.get(section_name)
            if not isinstance(section_data, dict):
                continue

            summary = section_data.get("summary", "")
            if not summary or not isinstance(summary, str):
                dropped_sections.append(section_name)
                continue

            # Verify evidence
            sources = section_data.get("sources", [])
            if not isinstance(sources, list) or len(sources) == 0:
                dropped_sections.append(section_name)
                continue

            valid_section_sources: list[dict[str, Any]] = []
            for src in sources:
                if not isinstance(src, dict):
                    continue
                url = src.get("url", "")
                title = src.get("title", "")
                retrieved_at = src.get("retrievedAt", "")

                # Must have URL, title, and date
                if not url or not title or not retrieved_at:
                    continue

                # URL must be among discovered sources
                if url in valid_urls:
                    valid_section_sources.append(
                        {
                            "url": url,
                            "title": title[:200],
                            "retrievedAt": retrieved_at,
                        }
                    )

            if not valid_section_sources:
                dropped_sections.append(section_name)
                continue

            # Sanitize summary text against stored prompt injection
            sanitized_summary, _ = cls.scan_and_sanitize_injection(summary)

            cleaned_section: dict[str, Any] = {
                "summary": sanitized_summary,
                "sources": valid_section_sources,
                "confidence": section_data.get("confidence", "documented"),
            }

            # Copy specific structured fields if valid
            for extra_key in ("categories", "primaryStack", "traits", "rounds"):
                if extra_key in section_data:
                    cleaned_section[extra_key] = section_data[extra_key]

            cleaned_pack[section_name] = cleaned_section

        return cleaned_pack, dropped_sections

    @classmethod
    def score_coverage(
        cls,
        pack: dict[str, Any],
    ) -> tuple[Literal["high", "medium", "low"] | None, str]:
        """Compute pack coverage tier based on count of valid evidenced sections."""
        evidenced_count = sum(
            1
            for section in EVIDENCED_SECTIONS
            if section in pack and isinstance(pack[section], dict)
        )

        if evidenced_count >= 4:
            return "high", "ready"
        if evidenced_count >= 2:
            return "medium", "ready"
        if evidenced_count >= 1:
            return "low", "ready"
        return None, "insufficient_data"
