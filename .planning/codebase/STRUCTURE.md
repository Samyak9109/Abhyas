# Codebase Structure & Placement Rules

**Analysis Date:** 2026-10-13

## Directory Organization

```text
/
├── apps/
│   ├── web/                    # React 18/19 + Vite client application
│   │   ├── src/
│   │   │   ├── app/            # Global providers, router, app layout shell
│   │   │   ├── components/     # Design token UI primitives (Button, Input, Dialog, etc.)
│   │   │   ├── features/       # Modular features (setup, interview, results, stats, settings)
│   │   │   ├── pages/          # Prerendered public marketing pages (PG-01 to PG-08)
│   │   │   ├── workers/        # PDF and document parsing Web Workers
│   │   │   ├── styles/         # tokens.css (CSS custom properties) and main styles
│   │   │   └── fonts/          # Self-hosted woff2 files (4 approved fonts)
│   └── api/                    # FastAPI research service (Phase 5 only)
├── packages/
│   ├── core/                   # Pure TypeScript domain package (no React, no DOM)
│   │   └── src/
│   │       ├── providers/      # ProviderAdapter interfaces and client implementations
│   │       ├── interview/      # Deterministic interview state machine and runner
│   │       ├── questions/      # Question selection engine and core-ask checks
│   │       ├── rubric/         # Multi-dimensional rubric evaluation logic
│   │       ├── skills/         # Skill taxonomy and confidence interval statistics
│   │       ├── schemas/        # Zod validation schemas (profile, evaluation, pack)
│   │       └── util/           # Mathematical and deterministic randomness helpers
│   └── content/                # Content and data packages
│       ├── questions/          # Question bank JSON fixtures
│       ├── rubrics/            # Level-anchored rubrics
│       └── taxonomy/           # Skill competency hierarchy
├── Assets/                     # Brand identity SVGs, PNGs, and favicons
└── docs/                       # Project specifications, privacy audits, and guides
```

## Where to Add New Code

| Type of Code | Directory | Rules & Constraints |
| --- | --- | --- |
| **Domain Logic / State Machine** | `packages/core/src/interview/` | Pure TypeScript. Zero React/DOM imports. Deterministic. |
| **AI Provider Adapters** | `packages/core/src/providers/` | Implement `ProviderAdapter` interface. Never log keys or prompt bodies. |
| **Validation Schemas** | `packages/core/src/schemas/` | Zod schemas. Export inferred TypeScript types. |
| **UI Components (Primitives)** | `apps/web/src/components/` | Must use design tokens only. Implement all states. WCAG 2.2 AA. |
| **Feature Screens & Hooks** | `apps/web/src/features/<feature>/` | Feature-scoped state (Zustand) and views. |
| **Document Parsers** | `apps/web/src/workers/` | Execute in Web Workers. Zero network requests during parsing. |
| **Public Pages** | `apps/web/src/pages/` | Prerendered static HTML. No app imports. Zero third-party requests. |
| **Question Bank Content** | `packages/content/questions/` | JSON format. Must validate against question schema. |

## File Naming Conventions

- **React Components:** PascalCase (e.g., `Button.tsx`, `InterviewRunner.tsx`).
- **Core Domain Logic & Utilities:** kebab-case (e.g., `state-machine.ts`, `provider-adapter.ts`).
- **Schemas:** kebab-case with `.schema.ts` suffix (e.g., `evaluation.schema.ts`).
- **Tests:** Same basename with `.test.ts` or `.spec.ts` suffix (e.g., `state-machine.test.ts`).
- **Design Tokens:** `tokens.css` with semantic CSS custom properties.
