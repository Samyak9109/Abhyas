# Project State: Abhyas

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-13)

**Core value:** Private, realistic out-loud interview practice calibrated to candidate resume and job description with zero server data leakage.  
**Current focus:** Phase 0: Foundations — Milestone M0.2 (Tokens, Fonts and Base Components)

## Current Position

- **Active Phase**: Phase 0: Foundations
- **Current Milestone**: M0.2 (Design tokens from `design.md` 4.2, self-hosted fonts woff2, base UI components, automated axe accessibility checks)
- **Completed Milestones**:
  - [x] M0.1: Repo and tooling (pnpm monorepo scaffolding, strict TypeScript, ESLint boundary rules, Vitest, Knip dead-code checks, CI workflow)
- **Status**: Ready for execution
- **Progress**: `[==------------------]` 10% (Phase 0 in progress: M0.1 complete)

## Performance Metrics

- Total requirements mapped: 30 / 30 (100% coverage)
- Blockers: 0
- Decisions locked: 22 (ADR-001 through ADR-022)

## Accumulated Context

### Critical Architectural Decisions
- Local-first architecture (Dexie IndexedDB); zero server proxying for candidate prompts (ADR-001, ADR-002).
- Pure TypeScript domain core in `packages/core` without React or DOM imports (ADR-016). Enforced by ESLint and TypeScript compiler lib settings.
- 4 self-hosted Latin-subset fonts (`Pixelify Sans`, `Instrument Sans`, `JetBrains Mono`, `Caveat`); zero font CDN calls (ADR-020).
- Retro-pixel design tokens with dark Ink and light Paper themes (ADR-021).
- Strict Knip and TypeScript dead-code enforcement in CI (ADR-022).

### Blockers / Open Questions
- None.

## Session Continuity

- Monorepo tooling and workspace operational (`apps/web`, `packages/core`, `packages/content`).
- ESLint boundary enforcement verified: core is framework-free and cannot import React or access DOM globals.
- Knip verified: catches unused files, exports, and unlisted dependencies.
- CI pipeline created in `.github/workflows/ci.yml`.
- Ready to begin Milestone M0.2: Design tokens, typography (self-hosted fonts), and accessible base components.
