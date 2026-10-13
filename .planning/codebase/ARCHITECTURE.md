# System Architecture

**Analysis Date:** 2026-10-13

## Architecture Principles

1. **Local-First & Accountless (ADR-001):** User profile, resume data, job descriptions, answers, transcripts, and evaluation results live strictly inside browser IndexedDB via Dexie. No user sign-in or server accounts exist.
2. **Direct Provider Connections (ADR-002):** The browser directly contacts candidate-configured AI providers. Project infrastructure never proxies interview prompts.
3. **Deterministic Core Logic (ADR-007):** Interview flow is governed by a pure, testable state machine in `packages/core`. The AI model generates responses and scores only.
4. **Framework-Free Core (ADR-016):** `packages/core` contains pure TypeScript domain logic and schemas with zero imports from React, ReactDOM, or browser DOM.
5. **Runtime Validation (AI-019):** Every external response, stored record, and import file is validated with Zod schemas. Untrusted model responses are never rendered as raw HTML.
6. **Strict Network Allowlist (NFR-017):** Outbound connections are locked down via CSP and verified by Playwright tests in CI.

## Monorepo Layout

```text
/
├── apps/
│   ├── web/                    # React + Vite client SPA
│   │   └── src/
│   │       ├── app/            # App shell, routing, global providers
│   │       ├── components/     # Design token UI primitives (Button, Input, Dialog, etc.)
│   │       ├── features/       # Feature modules (setup, interview, results, stats, settings)
│   │       ├── pages/          # Prerendered public pages and app screen wrappers
│   │       ├── workers/        # Web Worker document parsers (pdf.js, mammoth)
│   │       └── fonts/          # Self-hosted woff2 font files
│   └── api/                    # Optional Phase 5 FastAPI research backend
│       └── app/
│           ├── routes/         # Company search, request demand, health endpoints
│           ├── pipeline/       # Bounded LangGraph research scraper
│           └── db/             # PostgreSQL database client
├── packages/
│   ├── core/                   # Pure TypeScript domain package
│   │   └── src/
│   │       ├── providers/      # ProviderAdapter interfaces and implementations
│   │       ├── interview/      # Deterministic interview state machine and runner
│   │       ├── questions/      # Question selection engine and core-ask checks
│   │       ├── rubric/         # Multi-dimensional rubric evaluation logic
│   │       ├── skills/         # Skill taxonomy and confidence interval statistics
│   │       └── schemas/        # Shared Zod validation schemas
│   └── content/                # Static data and schemas
│       ├── questions/          # Versioned question bank JSON records
│       ├── rubrics/            # Level anchor rubrics
│       └── taxonomy/           # Skill competency taxonomy definitions
└── docs/                       # Architectural audits, privacy audits, and guides
```

## Data Flow & Interview Lifecycle

```text
1. Setup Screen: Candidate inputs resume + job description + selects role level.
2. Web Worker: Extracts text and qualifications locally with zero network egress.
3. Question Engine (core): Selects vetted questions from packages/content with seeded randomness.
4. Personalization: Direct API call adapts wording to candidate resume while preserving core ask.
5. Interview Runner (FSM): Controls transitions (Setup -> Question -> Listening -> Evaluating -> Complete).
6. Voice/Text: Push-to-talk Web Speech captures speech; transcripts editable before submit.
7. Rubric Evaluator: Evaluates transcript at temperature 0 with Zod schema validation.
8. Storage: Dexie saves turn records and rubric scores to IndexedDB.
9. Results: Displays top 3 fixes and grounded rewrites; aggregates multi-session skill statistics.
```

## Security & Privacy Model

- **No Server Tracking:** Zero analytics, telemetry, or remote crash reporting (ADR-018).
- **Key Storage:** Keys held in browser IndexedDB; optional WebCrypto passphrase encryption; keys never leave client origin except to the chosen provider (ADR-005).
- **Prompt Injection Defense:** Strict XML/delimited data boundary wrappers, schema-only outputs, no client tool execution, and injection test suite (AI-025).
- **Content Security Policy:** Strict CSP with `font-src 'self'`, `frame-ancestors 'none'`, and narrow `connect-src`.
