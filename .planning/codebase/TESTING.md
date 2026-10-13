# Testing Strategy & Patterns

**Analysis Date:** 2026-10-13

## Testing Pyramid

```text
▲ End-to-End (Playwright: network allowlist, offline shell, user flow)
├── Accessibility (axe-core: automated contrast & keyboard checks)
├── Contract Tests (Shared provider suite with recorded fixtures)
├── Integration (Dexie migration harness, FSM + mock provider)
└── Unit Tests (Vitest: FSM transitions, selection engine, Zod schemas, stats)
```

## Unit Testing (`packages/core`)

- **Runner:** Vitest
- **Scope:** State machine transitions, question selection engine, rubric parsing, statistical confidence math, Zod schemas.
- **Coverage Target:** >= 80% line coverage in `packages/core` (NFR-015).
- **Determinism:** Tests run with fixed clock and seeded PRNG.

## Provider Contract Test Suite

- **Pattern:** A single shared contract test suite (`provider-contract.spec.ts`) executed against each adapter (`GeminiAdapter`, `OpenAIAdapter`, `MockAdapter`).
- **Fixtures:** Uses recorded HTTP responses and mocks. **Zero real API keys in CI.**
- **Verification:** Asserts streaming token emission, structured schema parsing, error classification, and header redaction.

## Storage Migration Harness

- **Pattern:** Dexie migration tests execute sequential schema migrations against serialized fixtures from prior versions.
- **Rule:** When the Dexie schema version increments, commit a fixture of the prior version and verify bidirectional data integrity.

## Network Egress Allowlist Test (E2E)

- **Runner:** Playwright
- **Rule (NFR-017):** Automated network interceptor logs all outbound HTTP/WebSocket requests during end-to-end user flows.
- **Assertion:** Fails immediately if any request is dispatched to an origin not present on the documented allowlist (e.g. tracking scripts, font CDNs, unauthorized hosts).

## Accessibility Verification

- **Runner:** axe-core integrated into component and E2E suites.
- **Coverage:** Verified on all screens across both `Ink` (dark) and `Paper` (light) themes. Zero automated axe violations allowed.

## AI Evaluation Suite (Pre-Release)

- **Golden Set:** Golden dataset of >= 20 labeled transcripts with expert anchor scores.
- **Evaluation:** Evaluator runs at temperature 0; two consecutive runs must differ by <= 0.5 MAE.
- **Injection Suite:** Prompt injection benchmark verifying that resume/job descriptions cannot override system rubric boundaries.
