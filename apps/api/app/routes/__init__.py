"""Routes package root."""

from app.routes.admin import router as admin_router
from app.routes.companies import router as companies_router
from app.routes.health import router as health_router
from app.routes.reports import router as reports_router

__all__ = [
    "admin_router",
    "companies_router",
    "health_router",
    "reports_router",
]
