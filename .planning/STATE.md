# Project State: Abhyas

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-14)

**Core value:** Private, realistic out-loud interview practice calibrated to candidate resume and job description with zero server data leakage.
**Current focus:** Phase 1: MVP Core Loop & Public Site — next up is Milestone M1.1 (Storage, settings, data tools)

## Current Position

- **Active Phase**: Phase 1: MVP Core Loop & Public Site (Phase 0: Foundations complete)
- **Current Milestone**: M1.1 (persistent store, settings screen, theme, export, delete-all with typed confirmation — FR-001, FR-020, FR-030) — not started
- **Completed Milestones**:
  - [x] M0.1: Repo and tooling (pnpm monorepo scaffolding, strict TypeScript, ESLint boundary rules, Vitest, Knip dead-code checks, CI workflow)
  - [x] M0.2: Tokens, fonts and base components (design tokens for Ink and Paper themes, 4 self-hosted typefaces at 62.7 KB gzipped above-the-fold meeting NFR-025, 14 accessible base UI components, automated axe testing)
  - [x] M0.3: Core contracts (`ProviderAdapter` + mock provider, Zod schemas for profile/evaluation/pack, Dexie schema v1, migration harness) (NFR-023, ADR-004, ADR-006)
  - [x] M0.4: Content scaffolding (skill taxonomy v1, 5 level rubrics, question schema, CI validation) (FR-006, FR-007, FR-014, FR-017)
  - [x] M0.5: Compliance skeleton (MIT LICENSE, TRADEMARK.md, THIRD_PARTY_LICENSES, privacy audit, CSP baseline, network allowlist suite, license checker) (NFR-006, NFR-015, NFR-017, NFR-022)
  - [x] Phase 0 Exit Gate — all P0 milestones satisfied; completed 2026-10-13, re-verified locally 2026-10-14
- **Status**: Ready for execution (P1)
- **Progress**: Phase 0 complete (5/5 milestones + exit gate); Phase 1 not started

## Performance Metrics

- Total requirements mapped: 30 / 30 (100% coverage)
- Blockers: 0
- Decisions locked: 22 (ADR-001 through ADR-022)
- Font payload above the fold: 62.7 KB gzipped (Budget: <= 150 KB gzipped)
- Local CI (2026-10-14): lint, typecheck, knip, format, content validation and license checks green; tests 76/76 passing

## Accumulated Context

### Critical Architectural Decisions
- Local-first architecture (Dexie IndexedDB); zero server proxying for candidate prompts (ADR-001, ADR-002).
- Pure TypeScript domain core in `packages/core` without React or DOM imports (ADR-016).
- 4 self-hosted Latin-subset fonts (`Pixelify Sans`, `Instrument Sans`, `JetBrains Mono`, `Caveat`); zero font CDN calls (ADR-020).
- Retro-pixel design tokens with dark Ink and light Paper themes (ADR-021).
- 14 accessible base UI components tested with axe in both themes.
- Strict Knip and TypeScript dead-code enforcement in CI (ADR-022).

### Blockers / Open Questions
- P1 app-page designs pending: batch 1 (PG-10, PG-11, PG-12, PG-13, PG-14 minimal, PG-18) must be ready before those screens are built; PG-18 is needed before M1.1 (`phases.md` 6A).
- Question bank size and authoring plan `[OPEN: owner]` (`phases.md` P1 content note).

## Session Continuity

- P0 complete and committed; all milestones verified green locally on 2026-10-14.
- Typecheck fix (2026-10-14): vitest-axe 0.1.0 matcher types now augment Vitest 3's global `jest.Matchers` extension point in `apps/web/src/vitest-axe.d.ts`.
- Next: P1 M1.1 pending design batch 1; `phases.md` section 7 is the authoritative status tracker.
