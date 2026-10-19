"""SQLAlchemy data models for companies, packs, requests, jobs, and reports."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Declarative base class for research service models."""

    pass


class Company(Base):
    """Company record tracking research lifecycle and domain metadata (architecture 15.3)."""

    __tablename__ = "companies"

    slug: Mapped[str] = mapped_column(String(100), primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    canonical_domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    aliases: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="unknown",
        nullable=False,
        index=True,
    )
    last_researched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    coverage: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    packs: Mapped[list["Pack"]] = relationship(
        "Pack",
        back_populates="company",
        cascade="all, delete-orphan",
        order_by="desc(Pack.version)",
    )
    requests: Mapped[list["ResearchRequest"]] = relationship(
        "ResearchRequest",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    jobs: Mapped[list["ResearchJob"]] = relationship(
        "ResearchJob",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    reports: Mapped[list["Report"]] = relationship(
        "Report",
        back_populates="company",
        cascade="all, delete-orphan",
    )


class Pack(Base):
    """Versioned company research pack stored as evidenced JSON (architecture 15.3)."""

    __tablename__ = "packs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_slug: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("companies.slug", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    json_data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    ttl_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    company: Mapped["Company"] = relationship("Company", back_populates="packs")


class ResearchRequest(Base):
    """Demand-counting record deduplicated per client within daily salt window (ADR-010)."""

    __tablename__ = "research_requests"
    __table_args__ = (
        UniqueConstraint("company_slug", "day", "client_hash", name="uq_company_day_client"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_slug: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("companies.slug", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    client_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    company: Mapped["Company"] = relationship("Company", back_populates="requests")


class ResearchJob(Base):
    """Background research job tracking token usage, costs, and execution status."""

    __tablename__ = "research_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_slug: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("companies.slug", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_estimate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    checkpoint_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    company: Mapped["Company"] = relationship("Company", back_populates="jobs")


class Report(Base):
    """User report flagging incorrect or outdated company data (FR-029)."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_slug: Mapped[str] = mapped_column(
        String(100),
        ForeignKey("companies.slug", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pack_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("packs.id", ondelete="SET NULL"),
        nullable=True,
    )
    field: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        default="open",
        nullable=False,
        index=True,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    company: Mapped["Company"] = relationship("Company", back_populates="reports")
