# Architecture & Design Decisions

## ADR-001: Local-first, no accounts, no backend for the core app
- source: architecture.md
- status: locked (DECIDED)
- decision: All user data lives in the browser (IndexedDB via Dexie). No sign-in or user accounts. The core experience needs no server.
- scope: datastore, authentication, privacy, client-architecture

## ADR-002: Browser-direct calls with the user's own key
- source: architecture.md
- status: locked (DECIDED)
- decision: The browser calls AI providers directly with the user's API key. The project provides no AI for interviewing and never proxies user interview traffic.
- scope: AI provider integration, privacy, proxying, billing

## ADR-003: MIT license and repository layout
- source: architecture.md
- status: locked (DECIDED)
- decision: MIT license for repository code. Trademark note for name and logo. Monorepo structure with apps/ and packages/.
- scope: licensing, repository layout, open source

## ADR-004: IndexedDB through Dexie for storage
- source: architecture.md
- status: locked (DEFAULT)
- decision: Use Dexie over raw IndexedDB or localStorage for structured data, transactions, indexes, and migrations.
- scope: browser storage, database, schema migrations

## ADR-005: Key handling and storage
- source: architecture.md
- status: locked (DEFAULT)
- decision: Keys stored in local browser storage with optional WebCrypto passphrase encryption, strict CSP, never logged or exported in default exports.
- scope: secrets management, encryption, CSP, security

## ADR-006: Rubric-based structured evaluation
- source: architecture.md
- status: locked (DEFAULT)
- decision: Fixed criteria, 5 level anchors, temperature 0, schema-validated output, evidence excerpts, golden-set evaluations before releases.
- scope: scoring engine, evaluation rubrics, AI output validation

## ADR-007: Deterministic interview state machine; no LangGraph in the browser
- source: architecture.md
- status: locked (DEFAULT)
- decision: A small pure state machine in packages/core controls interview flow. LangGraph is not used client-side.
- scope: interview flow, state machine, runtime dependencies

## ADR-008: Company packs as versioned, evidence-bearing JSON with a static mirror
- source: architecture.md
- status: locked (DEFAULT)
- decision: Company research packs follow strict JSON schema with evidence excerpts; mirrored as static files; no ungrounded claims.
- scope: company packs, static mirror, data integrity

## ADR-009: Research backend: FastAPI + Postgres; server-side key used only for research
- source: architecture.md
- status: locked (DECIDED)
- decision: The only project server is an optional Phase 5 research service (FastAPI + Postgres). The project's AI key exists only there, only for company research, and never proxies user prompts.
- scope: backend architecture, research API, server keys

## ADR-010: Demand-gated research with a pre-seeded list and hard budget
- source: architecture.md
- status: locked (DECIDED)
- decision: Company research runs only for seeded companies or after meeting demand thresholds, enforced with hard daily and monthly budget caps.
- scope: research API, cost control, rate limiting

## ADR-011: LangGraph for the research pipeline
- source: architecture.md
- status: locked (DEFAULT)
- decision: Use LangGraph on the backend (Phase 5) for multi-step research graphs with Postgres checkpointer and review interrupts.
- scope: backend pipeline, research graph, agent orchestration

## ADR-012: Calendar integration approach
- source: architecture.md
- status: locked (DECIDED feature / DEFAULT approach)
- decision: .ics file export first; optional client-side Google OAuth with narrow calendar scope and in-memory tokens only.
- scope: calendar export, OAuth, privacy

## ADR-013: Local mode: in-browser engine by default, PC only, text only
- source: architecture.md
- status: locked (DECIDED)
- decision: Local models run on PC only, text-only, with a WebGPU in-browser engine as default and Ollama/OpenAI-compatible local servers as options. Disabled on mobile.
- scope: local AI, WebGPU, Ollama, hardware constraints

## ADR-014: Voice via browser speech APIs with push-to-talk
- source: architecture.md
- status: locked (DEFAULT)
- decision: MVP uses browser Web Speech API (speech recognition and synthesis) behind interfaces; push-to-talk with editable transcripts.
- scope: voice input, speech recognition, speech synthesis, fallbacks

## ADR-015: Frontend stack: React, TypeScript, Vite, Tailwind, shadcn primitives, Zustand
- source: architecture.md
- status: locked (DEFAULT)
- decision: React + Vite SPA, strict TypeScript, Tailwind CSS with design tokens, shadcn/ui primitives, Zustand for UI state. No SSR framework.
- scope: frontend stack, build tooling, UI state

## ADR-016: pnpm monorepo with a framework-free core package
- source: architecture.md
- status: locked (DEFAULT)
- decision: pnpm workspaces monorepo: apps/web, apps/api (P5), packages/core (framework-free domain logic, no DOM/React imports), packages/content.
- scope: monorepo architecture, package boundaries, modularity

## ADR-017: Custom model support with format allowlist and sanity test
- source: architecture.md
- status: locked (DECIDED feature / DEFAULT controls)
- decision: Users may configure custom models per provider with format allowlists, pre-flight parameter checks, post-load sanity testing, and unverified labeling.
- scope: custom models, model management, safety checks

## ADR-018: No client telemetry
- source: architecture.md
- status: locked (DECIDED stance / DEFAULT design)
- decision: Zero client-side telemetry, analytics, or remote crash reporting. Diagnostics are strictly local and redactable.
- scope: privacy, telemetry, observability

## ADR-019: Public pages from the same codebase, prerendered, separate small entry
- source: architecture.md
- status: locked (DEFAULT)
- decision: Public pages (PG-01 to PG-08) built from the same repository and design system, shipping as prerendered static HTML with a minimal entry bundle.
- scope: public marketing site, SEO, prerendering

## ADR-020: Self-hosted, locked typography
- source: architecture.md
- status: locked (DECIDED)
- decision: Locked typography self-hosted as Latin-subset woff2 files: Pixelify Sans (display), Instrument Sans (body), JetBrains Mono (labels/code), Caveat (handwritten notes). No font CDN.
- scope: typography, font self-hosting, CSP, privacy

## ADR-021: Token-based theming with Ink (default) and Paper
- source: architecture.md
- status: locked (DEFAULT)
- decision: All styling flows from semantic CSS custom properties; dark Ink (default) and light Paper themes switched via data-theme.
- scope: design tokens, dark/light theme, Tailwind config

## ADR-022: Agent working agreements: no dead code, token economy, automatic skills
- source: architecture.md
- status: locked (DECIDED)
- decision: AI agents and humans follow strict engineering rules: zero dead code/exports, token economy via selective reading, automatic skill utilization, and stable ID tracing.
- scope: development protocol, code quality, agent guidelines
