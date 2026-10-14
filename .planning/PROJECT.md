# Abhyas (अभ्यास)

## What This Is

Abhyas is a free, private, open-source web application where people practice job interviews out loud with an AI interviewer that knows their resume, the target job description, and the company culture. It delivers structured, rubric-based feedback and actionable answer improvements without requiring user accounts or third-party server proxies.

## Core Value

Candidates can practice realistic, out-loud job interviews calibrated to their exact resume and target role, with guaranteed privacy: all personal data, resumes, transcripts, and API keys remain strictly local to the user's browser.

## Business Context

- **Customer / Users**: Students and early-career job seekers (fresher to 3 years) preparing for high-stakes placement and technical interviews; secondarily, privacy-conscious engineers and coaches.
- **Revenue model**: Free and open-source (MIT license). Zero subscription fees or monetization.
- **Success metric**: Candidate reaches first practice question in under 3 minutes; >= 70% rate feedback "useful" or better; zero personal data ever reaches project servers.
- **Strategy notes**: MIT open-source core with voluntary community packs and optional self-hosted server deployments.

## Requirements

### Validated

*(None yet — ship Phase 0 foundations and Phase 1 MVP to validate)*

### Active

- [x] **P0-Foundations**: Monorepo setup (`apps/web`, `packages/core`, `packages/content`), strict TypeScript, design tokens, self-hosted typography, Dexie schema v1, and CI/CD pipelines. (completed 2026-10-13)
- [ ] **P1-Core Loop**: Ingest resume and job description in a Web Worker, deterministic FSM interview runner, push-to-talk browser voice, rubric evaluation with temperature 0, and actionable rewrites.
- [ ] **P2-Skills & Calibration**: Multi-session skill tracking with confidence intervals, single-skill drills, and habit streak tracking.
- [ ] **P3-Local Mode**: Offline text interview mode via WebGPU in-browser engine (WebLLM) and Ollama local server support.
- [ ] **P4-Company Packs**: Curated static company interview packs with evidence-backed questions.
- [ ] **P5-Research Service**: Bounded FastAPI + LangGraph scraping pipeline for on-demand company pack generation with hard budget caps.
- [ ] **P6-Calendar Integration**: `.ics` prep schedule export and optional Google Calendar OAuth integration.
- [ ] **P7-Advanced**: Custom community packs and on-device Whisper speech recognition.

### Out of Scope

- **User Accounts & Server Database for Candidates**: Resumes and transcripts must never live on a central server (ADR-001).
- **Shared AI API Key for Interviewing**: The project does not provide or proxy user interview calls; candidates supply their own keys or use local models (ADR-002).
- **Live Interview Copilot**: Abhyas is strictly for practice; it does not listen in on real interviews.
- **Video Analysis & Computer Vision**: Focus is solely on speech delivery, STAR answer structure, and technical depth.
- **Commercial Paywalls / Subscriptions**: Open-source MIT model (ADR-003).

## Context

- **Target Architecture**: Local-first Single Page Application with zero server proxying.
- **Design Language**: Retro-pixel display aesthetic ("Ink" dark theme and "Paper" light theme) with warm accents and pixel monitor-head interviewer mascot.
- **Font Policy**: 4 self-hosted Latin-subset fonts (`Pixelify Sans`, `Instrument Sans`, `JetBrains Mono`, `Caveat`). Zero font CDNs.
- **Authority Hierarchy**: `PRD.md` > `architecture.md` > `design.md` > `phases.md` > `existing code`.

## Constraints

- **Privacy**: Zero resume, transcript, answer, or key data may reach the project's servers. Outbound network egress strictly governed by CSP allowlist.
- **Typography**: Locked, self-hosted fonts only. No font CDN requests allowed.
- **Domain Purity**: `packages/core` must have zero imports from React, ReactDOM, or browser DOM APIs.
- **Code Quality**: Zero dead code, unused exports, or dead dependencies (enforced by Knip and TS strict rules).
- **Deterministic Evaluation**: Rubrics evaluate at temperature 0 with strict Zod schema validation; consecutive runs <= 0.5 MAE.

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| **ADR-001: Local-first architecture** | Absolute candidate privacy; zero server storage costs | ✅ Decided |
| **ADR-002: Direct provider calls** | Eliminates proxy infrastructure costs and security liability | ✅ Decided |
| **ADR-003: MIT License** | Maximum community trust and adoption | ✅ Decided |
| **ADR-004: Dexie IndexedDB** | Structured client storage, transactions, and migration harness | ✅ Decided |
| **ADR-005: Local key encryption** | WebCrypto passphrase protection without backend reliance | ✅ Decided |
| **ADR-006: Rubric-based scoring** | Objective, reproducible STAR feedback over chat hallucinations | ✅ Decided |
| **ADR-007: Deterministic FSM** | Pure state machine in core; no client-side LangGraph | ✅ Decided |
| **ADR-013: Local WebGPU / Ollama** | Offline text practice on supported PCs | ✅ Decided |
| **ADR-014: Browser Web Speech API** | Zero transcription costs for push-to-talk MVP | ✅ Decided |
| **ADR-016: pnpm monorepo layout** | Clear package boundaries (`apps/web`, `packages/core`, `packages/content`) | ✅ Decided |
| **ADR-020: Self-hosted typography** | Prevents IP leakage to font CDNs; guarantees brand integrity | ✅ Decided |
| **ADR-021: Token-based theming** | Semantic CSS custom properties for Ink and Paper themes | ✅ Decided |
| **ADR-022: Agent working agreements** | Zero dead code, token economy, automated tool invocation | ✅ Decided |

---
*Last updated: 2026-10-14 — Phase 0 completion synced with `phases.md` (authoritative status tracker)*
