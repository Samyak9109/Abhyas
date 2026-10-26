"""Budget guard, spending tracker, and kill-switch manager (M5.3, ADR-010, architecture 15.3)."""

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.models import ResearchJob


class BudgetManager:
    """Manages daily/monthly budget caps, per-job limits, and emergency kill-switch."""

    _runtime_kill_switch: bool | None = None

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @classmethod
    def is_kill_switch_active(cls, settings: Settings | None = None) -> bool:
        """Check if kill switch is activated either via runtime flag or settings."""
        if cls._runtime_kill_switch is not None:
            return cls._runtime_kill_switch
        current_settings = settings or get_settings()
        return current_settings.kill_switch_active

    @classmethod
    def set_kill_switch(cls, active: bool) -> None:
        """Toggle runtime kill switch (operator intervention or test override)."""
        cls._runtime_kill_switch = active

    @classmethod
    def reset_kill_switch(cls) -> None:
        """Reset runtime kill switch to follow environment configuration."""
        cls._runtime_kill_switch = None

    async def get_daily_spend_cents(self, session: AsyncSession) -> float:
        """Sum cost_estimate for all jobs started since UTC midnight."""
        today_start = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=UTC)
        stmt = select(func.coalesce(func.sum(ResearchJob.cost_estimate), 0.0)).where(
            ResearchJob.started_at >= today_start
        )
        return float((await session.execute(stmt)).scalar() or 0.0)

    async def get_monthly_spend_cents(self, session: AsyncSession) -> float:
        """Sum cost_estimate for all jobs started since start of current UTC month."""
        today = date.today()
        month_start = datetime(today.year, today.month, 1, tzinfo=UTC)
        stmt = select(func.coalesce(func.sum(ResearchJob.cost_estimate), 0.0)).where(
            ResearchJob.started_at >= month_start
        )
        return float((await session.execute(stmt)).scalar() or 0.0)

    async def can_start_job(
        self,
        session: AsyncSession,
        estimated_cost_cents: float = 0.0,
    ) -> tuple[bool, str | None]:
        """Verify whether a new research job can run within budget caps and kill switch."""
        if self.is_kill_switch_active(self.settings):
            return False, "Kill switch is active: research service is paused"

        daily_spent = await self.get_daily_spend_cents(session)
        if daily_spent + estimated_cost_cents >= self.settings.daily_budget_cents:
            return (
                False,
                f"Daily budget cap exceeded: spent {daily_spent:.1f} cents, "
                f"cap is {self.settings.daily_budget_cents} cents",
            )

        monthly_spent = await self.get_monthly_spend_cents(session)
        if monthly_spent + estimated_cost_cents >= self.settings.monthly_budget_cents:
            return (
                False,
                f"Monthly budget cap exceeded: spent {monthly_spent:.1f} cents, "
                f"cap is {self.settings.monthly_budget_cents} cents",
            )

        return True, None

    def check_job_limits(
        self,
        tokens_used: int,
        elapsed_seconds: float,
        pages_count: int,
        cost_estimate_cents: float = 0.0,
    ) -> tuple[bool, str | None]:
        """Check whether an active job exceeded per-job safety limits (architecture 15.3)."""
        if pages_count > self.settings.max_pages_per_job:
            return (
                False,
                f"Job page limit exceeded: {pages_count} > {self.settings.max_pages_per_job}",
            )

        if tokens_used > self.settings.max_tokens_per_job:
            return (
                False,
                f"Job token limit exceeded: {tokens_used} > {self.settings.max_tokens_per_job}",
            )

        if elapsed_seconds > self.settings.max_runtime_seconds_per_job:
            return (
                False,
                f"Job runtime limit exceeded: {elapsed_seconds:.1f}s > "
                f"{self.settings.max_runtime_seconds_per_job}s",
            )

        if cost_estimate_cents > self.settings.max_cost_cents_per_job:
            return (
                False,
                f"Job cost limit exceeded: {cost_estimate_cents:.1f} > "
                f"{self.settings.max_cost_cents_per_job} cents",
            )

        return True, None

    @staticmethod
    def calculate_alert_level(spent_cents: float, cap_cents: int) -> tuple[str, str | None]:
        """Calculates alert tier (100%, 80%, 50%, or ok) based on spend vs cap (M5.5)."""
        if cap_cents <= 0:
            return "ok", None
        ratio = spent_cents / float(cap_cents)
        if ratio >= 1.0:
            return "100%", f"CRITICAL: 100% of budget cap reached ({spent_cents:.1f}/{cap_cents} cents)"
        if ratio >= 0.8:
            return "80%", f"WARNING: 80% of budget cap reached ({spent_cents:.1f}/{cap_cents} cents)"
        if ratio >= 0.5:
            return "50%", f"NOTICE: 50% of budget cap reached ({spent_cents:.1f}/{cap_cents} cents)"
        return "ok", None

    async def get_budget_alerts(self, session: AsyncSession) -> dict[str, Any]:
        """Check current daily and monthly spending against 50%, 80%, 100% thresholds (M5.5)."""
        daily_spent = await self.get_daily_spend_cents(session)
        monthly_spent = await self.get_monthly_spend_cents(session)

        daily_level, daily_msg = self.calculate_alert_level(
            daily_spent, self.settings.daily_budget_cents
        )
        monthly_level, monthly_msg = self.calculate_alert_level(
            monthly_spent, self.settings.monthly_budget_cents
        )

        active_alerts: list[str] = []
        if daily_msg:
            active_alerts.append(f"[Daily] {daily_msg}")
        if monthly_msg:
            active_alerts.append(f"[Monthly] {monthly_msg}")

        return {
            "daily_level": daily_level,
            "monthly_level": monthly_level,
            "daily_spent_cents": daily_spent,
            "monthly_spent_cents": monthly_spent,
            "daily_budget_cents": self.settings.daily_budget_cents,
            "monthly_budget_cents": self.settings.monthly_budget_cents,
            "active_alerts": active_alerts,
        }

    def drill_budget_alert(
        self,
        simulated_percentage: int,
        scope: str = "daily",
    ) -> dict[str, Any]:
        """Simulate an alert firing at 50, 80, or 100% of budget (M5.5 drill acceptance criteria)."""
        cap = (
            self.settings.daily_budget_cents
            if scope == "daily"
            else self.settings.monthly_budget_cents
        )
        simulated_spent = (simulated_percentage / 100.0) * cap
        level, msg = self.calculate_alert_level(simulated_spent, cap)
        alert_fired = level != "ok"

        return {
            "alert_fired": alert_fired,
            "level": level,
            "scope": scope,
            "simulated_percentage": simulated_percentage,
            "simulated_spent_cents": round(simulated_spent, 2),
            "cap_cents": cap,
            "message": msg or f"Spend is within normal bounds ({simulated_percentage}%)",
        }
