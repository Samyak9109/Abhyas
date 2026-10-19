"""FastAPI application entry point for Abhyas Research Service (Phase 5)."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.database import init_db
from app.routes.admin import router as admin_router
from app.routes.companies import router as companies_router
from app.routes.health import router as health_router
from app.routes.reports import router as reports_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager for startup and shutdown tasks."""
    # Initialize database tables
    await init_db()
    yield


app = FastAPI(
    title="Abhyas Research Service",
    description="Backend research service for demand-gated company pack creation (FR-026, FR-029).",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

# CORS configuration restricted to authorized origins (architecture 15.3)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Safety redaction handler to ensure server secrets and trace internals are never leaked."""
    # In test/dev, return standard detail if already an HTTPException, else redact
    from fastapi import HTTPException

    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=exc.headers,
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred"},
    )


# Register modular routers
app.include_router(health_router)
app.include_router(companies_router)
app.include_router(reports_router)
app.include_router(admin_router)
