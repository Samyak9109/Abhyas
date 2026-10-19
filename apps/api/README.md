# Abhyas Research Service (apps/api)

Backend research service for demand-gated company pack creation (Phase 5: FR-026, FR-029; ADR-009, ADR-010, ADR-011).

## Scope & Architectural Guardrails
- Used **only** for company pack research within strict budget caps.
- **Never** proxies user interview sessions, handles resumes, job descriptions, answers, or candidate data.
- **No free-form prompt endpoint**: all inputs are strictly typed and schema-validated.
- Server secrets (`ADMIN_SECRET`, `TURNSTILE_SECRET_KEY`, `PROJECT_AI_API_KEY`) remain strictly on the server and are never returned to clients.

## Endpoints
- `GET /healthz`: Service health and budget status
- `GET /v1/companies?q=`: Autocomplete search and company pack statuses
- `GET /v1/companies/{slug}`: Pack payload or current research status
- `POST /v1/companies/{slug}/request`: Register community demand (rate-limited, Turnstile-protected)
- `POST /v1/reports`: Flag incorrect or outdated company data (rate-limited, Turnstile-protected)
- `POST /v1/admin/seed`: Seed vetted company packs (secret-protected)
- `POST /v1/admin/rollback`: Rollback pack version (secret-protected)
- `POST /v1/admin/run-job`: Manual job dispatch (secret-protected)

## Running Locally
```bash
# Activate virtual environment
apps/api/.venv/Scripts/activate

# Run tests
pytest

# Run server
uvicorn app.main:app --reload --port 8000
```
