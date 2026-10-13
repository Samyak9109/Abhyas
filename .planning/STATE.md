# Project State: Abhyas

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-13)

**Core value:** Private, realistic out-loud interview practice calibrated to candidate resume and job description with zero server data leakage.  
**Current focus:** Phase 0: Foundations — Milestone M0.3 (Core Contracts)

## Current Position

- **Active Phase**: Phase 0: Foundations
- **Current Milestone**: M0.3 (`ProviderAdapter` interface, mock provider, Zod schemas for profile, evaluation, pack, storage interface, Dexie schema v1, migration harness)
- **Completed Milestones**:
  - [x] M0.1: Repo and tooling (pnpm monorepo scaffolding, strict TypeScript, ESLint boundary rules, Vitest, Knip dead-code checks, CI workflow)
  - [x] M0.2: Tokens, fonts and base components (Design tokens for Ink and Paper themes, 4 self-hosted typefaces measured at 62.7 KB gzipped above-the-fold meeting NFR-025, 14 accessible base UI components, automated axe testing with 0 violations)
- **Status**: Ready for execution
- **Progress**: `[====----------------]` 20% (Phase 0 in progress: M0.1, M0.2 complete)

## Performance Metrics

- Total requirements mapped: 30 / 30 (100% coverage)
- Blockers: 0
- Decisions locked: 22 (ADR-001 through ADR-022)
- Font payload above the fold: 62.7 KB gzipped (Budget: <= 150 KB gzipped)

## Accumulated Context

### Critical Architectural Decisions
- Local-first architecture (Dexie IndexedDB); zero server proxying for candidate prompts (ADR-001, ADR-002).
- Pure TypeScript domain core in `packages/core` without React or DOM imports (ADR-016).
- 4 self-hosted Latin-subset fonts (`Pixelify Sans`, `Instrument Sans`, `JetBrains Mono`, `Caveat`); zero font CDN calls (ADR-020).
- Retro-pixel design tokens with dark Ink and light Paper themes (ADR-021).
- 14 accessible base UI components tested with axe in both themes.
- Strict Knip and TypeScript dead-code enforcement in CI (ADR-022).

### Blockers / Open Questions
- None.

## Session Continuity

- Monorepo tooling and workspace operational (`apps/web`, `packages/core`, `packages/content`).
- Design system tokens and self-hosted fonts fully wired.
- 14 accessible base UI components implemented and axe-tested in both themes.
- Ready to begin Milestone M0.3: Core contracts (`ProviderAdapter`, Dexie IndexedDB schema v1, Zod validation schemas, migration harness).
