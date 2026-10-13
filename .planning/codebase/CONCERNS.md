# Architecture Concerns & Guardrails

**Analysis Date:** 2026-10-13

## Current Status: Greenfield Baseline

The codebase is currently in its initial pre-scaffolding state with zero existing legacy technical debt. All specification and architecture contracts are established upfront.

## Technical Risks & Guardrails

### 1. Privacy & Network Egress Integrity
- **Risk:** Accidental leakage of user resumes, transcripts, or API keys to external endpoints or analytics services.
- **Guardrail:** Strict Content Security Policy (`connect-src` limited to explicit provider origins). Automated Playwright network allowlist test fails the build if an unlisted origin is contacted (NFR-017). Zero remote telemetry (ADR-018).

### 2. Font CDN Leakage
- **Risk:** Modern web templates frequently import Google Fonts via external CDNs, which leaks candidate IP addresses and violates privacy invariants.
- **Guardrail:** Typography is strictly self-hosted as Latin-subset woff2 files in `apps/web/src/fonts/` (ADR-020). Lint rule and CSP `font-src 'self'` enforce that no CDN is queried.

### 3. Monorepo Boundary Leaks
- **Risk:** UI dependencies (React, DOM APIs) leaking into `packages/core`, compromising testability and state machine purity.
- **Guardrail:** Strict ESLint import boundary rules prevent `packages/core` from importing anything from `react`, `react-dom`, or `apps/*` (ADR-016).

### 4. Client Bundle Budget
- **Risk:** Heavy PDF parsers, Recharts graphing libraries, and WebGPU engines bloating the initial page load.
- **Guardrail:** Enforce a strict 300 KB gzip initial bundle budget (NFR-001). PDF parsing is isolated in Web Workers; charts, model manager, and interview runners are code-split and lazy-loaded.

### 5. Dead Code Accumulation
- **Risk:** Speculative abstractions, unused helper functions, or stale dependencies lingering in the repo.
- **Guardrail:** Knip and TypeScript unused-locals checks run in CI on every PR. Superseded code must be deleted in the same commit.
