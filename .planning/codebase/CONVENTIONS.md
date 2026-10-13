# Coding Conventions & Standards

**Analysis Date:** 2026-10-13

## Type Safety & TypeScript Standards

- **Strict Mode:** TypeScript `strict: true` is enabled across all packages.
- **No Escapes:** Avoid `any`, loose `as` type assertions, and `@ts-ignore` / `@ts-nocheck`.
- **Runtime Validation:** External data, user uploads, AI model outputs, and IndexedDB storage rows must be parsed using Zod schemas at runtime.
- **Type Derivation:** Infer TypeScript types directly from Zod schemas (`z.infer<typeof Schema>`).

## Styling & Design Tokens (ADR-021)

- **Zero Raw Colors or Arbitrary Spacing:** All colors, typography, line-heights, radii, and shadows must use semantic CSS custom properties defined in the token system (e.g., `var(--color-ink-bg)`, `var(--color-paper-card)`).
- **Theming:** Support both `Ink` (dark ground, default) and `Paper` (light ground) themes via the `data-theme` attribute.
- **Accessibility:** All interactive elements must satisfy WCAG 2.2 AA contrast ratios and focus ring visibility in both themes.
- **Typography:** Self-hosted fonts only (`Pixelify Sans`, `Instrument Sans`, `JetBrains Mono`, `Caveat`). No font CDN URLs.

## UI Component State Requirements

Every component and screen must implement all relevant states:
1. **Default**
2. **Loading / Streaming**
3. **Empty**
4. **Error / Recovery**
5. **Offline**
6. **Permission (Microphone)**

## Code Cleanliness & Dead Code Prevention (ADR-022)

- **Zero Dead Code:** No unused functions, exports, files, components, hooks, styles, tokens, dependencies, or commented-out blocks.
- **Automated Verification:** CI executes Knip and TypeScript unused-locals checks on every pull request.
- **Delete Obsolete Code:** When refactoring, delete the superseded code in the same pull request.

## Professional Commenting

- Comments must explain **WHY** (design intent, constraints, security rationale, trade-offs).
- Never write tutorial narration or syntax explanation ("increments counter").
- Maintain all existing comments when making targeted patches.

## Requirement Traceability

- Every task, feature commit, and test file must trace back to stable IDs defined in specifications:
  - Functional requirements: `// FR-012`
  - Non-functional requirements: `// NFR-006`
  - Architecture decisions: `// ADR-007`
  - Milestones: `// M0.1`
