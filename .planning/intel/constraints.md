# System Constraints — Abhyas

## Constraint: Local-First Client Architecture
- source: architecture.md
- type: nfr
- content: All user data (resumes, job descriptions, answers, transcripts, evaluation results, keys) must reside strictly in the user's browser (IndexedDB via Dexie). The application core requires zero server components and zero user accounts.

## Constraint: Direct AI Provider Calls & Zero Proxying
- source: architecture.md
- type: protocol
- content: The browser talks directly to the user's chosen AI provider using the user's own API key. The project never proxies interviewing traffic or uses project AI keys for interviewing.

## Constraint: Framework-Free Core Domain Logic
- source: architecture.md
- type: api-contract
- content: `packages/core` contains pure TypeScript domain logic (state machines, question selection, rubrics, statistical aggregations, schemas, prompt templates). It must have ZERO imports from React, ReactDOM, or browser DOM APIs.

## Constraint: Runtime Schema Validation
- source: architecture.md
- type: schema
- content: Every external input, AI provider response, stored record in Dexie, import file, and exported file must be validated at runtime with Zod schemas. Untrusted model responses must never be parsed or rendered without validation.

## Constraint: Locked Self-Hosted Typography
- source: design.md
- type: nfr
- content: Only four typefaces are permitted: Pixelify Sans (display), Instrument Sans (body), JetBrains Mono (labels/code), and Caveat (handwritten accents). All fonts must be self-hosted Latin-subset woff2 files. No font CDN requests allowed. Total font payload budget: <= 120 KB gzip across all four fonts (NFR-025).

## Constraint: Design Token Enforcement & Accessibility
- source: design.md
- type: nfr
- content: All visual styling must use semantic CSS custom properties defined in the token system. No raw colors, arbitrary spacing, or unapproved font families in component files. Must achieve WCAG 2.2 AA contrast and keyboard accessibility across both themes (Ink and Paper).

## Constraint: Content Security Policy & Network Egress Allowlist
- source: architecture.md
- type: protocol
- content: Outbound network egress is restricted via CSP and verified by Playwright tests. Allowed domains are strictly limited to the user's configured AI provider (Google Generative AI, OpenAI, or local endpoint), model hosts in local mode, and the static mirror for company packs. Zero third-party analytics or trackers.

## Constraint: Performance & Bundle Budgets
- source: architecture.md
- type: nfr
- content: Initial JavaScript bundle must not exceed 300 KB gzipped. Interview flow, Recharts, PDF parser, and local inference engines must be lazy-loaded in separate code chunks. First streamed response token within 2 seconds under normal network conditions.

## Constraint: Zero Dead Code Enforcement
- source: architecture.md
- type: nfr
- content: Enforced via CI using Knip, TypeScript strict mode, and unused-locals rules. No unused exports, files, dependencies, styles, tokens, stubs, or commented-out code permitted.
