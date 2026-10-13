# Technology Stack

**Analysis Date:** 2026-10-13

## Languages

**Primary:**
- TypeScript (Strict) - All client code (`apps/web`), core logic (`packages/core`), and content schemas (`packages/content`).

**Secondary:**
- Python 3.11+ - Dedicated research backend service (`apps/api` in Phase 5).

## Runtime

**Environment:**
- Node.js >= 20.12.0 (LTS)
- Python 3.11 (backend only)

**Package Manager:**
- pnpm >= 9.0.0 (workspaces monorepo)
- Lockfile: `pnpm-lock.yaml` (pinned exact versions, `save-exact=true`)

## Frameworks

**Core Client:**
- React (Vite SPA) - `apps/web`
- Tailwind CSS + CSS custom properties (Design tokens from `design.md`)
- shadcn/ui accessible primitives (radix-based)
- Zustand (UI state management)
- Dexie (IndexedDB client datastore)
- Zod (Runtime validation for all external data and AI outputs)

**Core Logic:**
- Framework-free TypeScript in `packages/core` (zero React or DOM imports)

**Backend (Phase 5 Research Service):**
- FastAPI + Pydantic
- LangGraph (bounded research graph pipeline)
- PostgreSQL (JSONB packs and request tracking)

**Testing:**
- Vitest (Unit and integration tests in core and web)
- Testing Library (React component tests)
- Playwright (End-to-end tests, network egress allowlist tests, offline shell tests)
- axe-core (Automated accessibility checks for WCAG 2.2 AA)

**Build & Code Quality:**
- Vite (Client bundling with lazy chunking)
- Knip (Automated dead-code and unused-dependency checking)
- ESLint + Prettier (Strict linting, import boundaries, and code formatting)

## Key Dependencies & APIs

**Critical:**
- Google Gemini API SDK / direct REST client (direct browser calls with user key)
- OpenAI API client / compatible endpoint adapter (direct browser calls with user key)
- Web Speech API (`SpeechRecognition`, `SpeechSynthesis` browser native)
- pdf.js & mammoth (Web Worker document parsing)
- WebLLM (in-browser WebGPU inference engine for local mode in Phase 3)

## Typography

- `Pixelify Sans` (Display headers, Latin-subset self-hosted woff2)
- `Instrument Sans` (Body text, Latin-subset self-hosted woff2)
- `JetBrains Mono` (Labels, buttons, metrics, code, Latin-subset self-hosted woff2)
- `Caveat` (Editorial annotations, Latin-subset self-hosted woff2)
- Zero font CDN calls (ADR-020).
