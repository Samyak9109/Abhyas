"""Configuration and environment settings for the research service."""

import logging
from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

INSECURE_DEV_SECRET = "dev-admin-secret-change-me"


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server Runtime
    environment: str = Field(default="development", alias="ENVIRONMENT")
    port: int = Field(default=8000, alias="PORT")
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:4173"],
        alias="CORS_ORIGINS",
    )

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///abhyas_research.db",
        alias="DATABASE_URL",
    )

    # Server-Side AI Provider (used only for research pipeline, never for interviewing)
    project_ai_provider: str = Field(default="gemini", alias="PROJECT_AI_PROVIDER")
    project_ai_api_key: str = Field(default="", alias="PROJECT_AI_API_KEY")

    # Search API
    search_api_key: str = Field(default="", alias="SEARCH_API_KEY")

    # Admin Authentication Secret (fail-fast in prod/staging; dev fallback only)
    admin_secret: str = Field(default="", alias="ADMIN_SECRET")

    # Cost Control & Budget Caps (in cents)
    daily_budget_cents: int = Field(default=500, alias="DAILY_BUDGET_CENTS")
    monthly_budget_cents: int = Field(default=10000, alias="MONTHLY_BUDGET_CENTS")

    # Kill Switch (stops all research jobs immediately when active)
    kill_switch_active: bool = Field(default=False, alias="KILL_SWITCH_ACTIVE")

    # Per-Job Limits (architecture 15.3)
    max_pages_per_job: int = Field(default=5, alias="MAX_PAGES_PER_JOB")
    max_tokens_per_job: int = Field(default=50000, alias="MAX_TOKENS_PER_JOB")
    max_runtime_seconds_per_job: int = Field(default=60, alias="MAX_RUNTIME_SECONDS_PER_JOB")
    max_cost_cents_per_job: int = Field(default=25, alias="MAX_COST_CENTS_PER_JOB")

    # Cloudflare Turnstile anti-bot secret
    turnstile_secret_key: str = Field(default="", alias="TURNSTILE_SECRET_KEY")

    # Gating & TTL Parameters (ADR-010)
    demand_threshold: int = Field(default=5, description="Requests required to queue research")
    demand_window_days: int = Field(default=14, description="Rolling demand calculation window")
    pack_default_ttl_days: int = Field(default=30, description="Pack validity before stale")
    insufficient_data_cooldown_days: int = Field(
        default=30, description="Cooldown before retrying insufficient data"
    )
    stale_cooldown_days: int = Field(
        default=14, description="Cooldown before refreshing a stale company"
    )

    # Static Mirror Export Directory (architecture 15.3)
    static_mirror_dir: str = Field(default="static_mirror", alias="STATIC_MIRROR_DIR")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        return ["http://localhost:5173", "http://localhost:4173"]

    @field_validator("database_url", mode="after")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        # Normalize postgres:// and postgresql:// to asyncpg dialect for SQLAlchemy async
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://") and not value.startswith("postgresql+asyncpg://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        if value.startswith("sqlite://") and not value.startswith("sqlite+aiosqlite://"):
            return value.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return value

    @model_validator(mode="after")
    def validate_admin_secret(self) -> "Settings":
        # Security: fail-fast on startup in production or staging if ADMIN_SECRET is unset or insecure default
        env = (self.environment or "development").strip().lower()
        secret = (self.admin_secret or "").strip()

        if env in ("production", "staging"):
            if not secret or secret == INSECURE_DEV_SECRET:
                raise ValueError(
                    f"ADMIN_SECRET must be explicitly set to a strong secret in {env} environment. "
                    "Insecure default or empty secret is forbidden."
                )
        elif env == "development":
            if not secret:
                logger.warning(
                    "ADMIN_SECRET is not configured; using development fallback secret. "
                    "Do NOT use this in staging or production environments."
                )
                self.admin_secret = INSECURE_DEV_SECRET
        return self


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
