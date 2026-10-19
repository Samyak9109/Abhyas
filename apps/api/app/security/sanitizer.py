"""Input validation and sanitization utilities (FR-026, AI-019)."""

import re

from fastapi import HTTPException, status

SLUG_REGEX = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate_company_slug(slug: str) -> str:
    """Validate kebab-case company slug to prevent path traversal or parameter tampering."""
    cleaned = slug.strip().lower()
    if not cleaned or len(cleaned) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company slug must be between 1 and 100 characters",
        )
    if not SLUG_REGEX.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Company slug must consist only of lowercase alphanumeric "
                "characters separated by single hyphens"
            ),
        )
    return cleaned


def sanitize_text(text: str, max_length: int = 1000) -> str:
    """Strip dangerous control characters while preserving readable prose."""
    # Remove null bytes and non-printable control characters (except newline and tab)
    cleaned = "".join(ch for ch in text if ch in ("\n", "\r", "\t") or ord(ch) >= 32)
    cleaned = cleaned.strip()
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length]
    return cleaned
