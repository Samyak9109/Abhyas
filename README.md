# Abhyas (अभ्यास)

> A free, private, open-source web application where candidates practice job interviews out loud with an AI interviewer calibrated to their resume, the target job description, and company culture — with honest, actionable skill feedback.

---

## Overview

Most candidates lack access to realistic, feedback-rich interview coaching. Generic chatbots provide unstructured conversation without speech practice, and existing mock-interview commercial services often require user accounts, upload sensitive resumes to third-party databases, and impose subscription fees.

**Abhyas** is built on an uncompromising local-first, privacy-by-design foundation:
- **Local-First Data:** Resumes, job descriptions, transcripts, rubrics, and skill statistics are stored entirely in your browser (`IndexedDB` via Dexie). There are no user accounts, tracking cookies, or central databases.
- **Direct AI Provider Calls:** Your browser connects directly to your chosen AI provider (Google Gemini, OpenAI, or compatible local/cloud endpoints) using your own API key. Keys can be WebCrypto-encrypted locally and never touch any project proxy server.
- **Offline & Local Text Mode:** Run text mock interviews completely offline using in-browser WebGPU models or local Ollama servers.
- **Honest Feedback:** Multi-dimensional rubric evaluations (STAR structure, technical accuracy, clarity, delivery) with grounded rewrites that never hallucinate candidate qualifications.
- **Retro-Pixel Aesthetics:** High-contrast, keyboard-accessible "Ink" and "Paper" visual language with self-hosted typography and zero CDN dependencies.

---

## Source of Truth & Project Documentation

All design, architecture, and roadmap specifications follow a strict authority hierarchy:

$$\text{PRD.md} > \text{architecture.md} > \text{design.md} > \text{phases.md} > \text{existing code}$$

| Document | Purpose & Key Contents |
| --- | --- |
| [PRD.md](file:///d:/Codes/Agents/Abhyas/PRD.md) | Authority level 1: Requirements (FR-001–033, NFR-001–025, AI-001–025), user personas, journeys, and data boundaries. |
| [architecture.md](file:///d:/Codes/Agents/Abhyas/architecture.md) | Authority level 2: Monorepo layout, provider adapters, state machine, Dexie schema, security/CSP, and ADR-001 through ADR-022. |
| [design.md](file:///d:/Codes/Agents/Abhyas/design.md) | Authority level 3: Retro-pixel design system, design tokens, self-hosted fonts, component specifications, and accessibility (WCAG 2.2 AA). |
| [phases.md](file:///d:/Codes/Agents/Abhyas/phases.md) | Authority level 4: Delivery schedule (P0 Foundations to P7 Advanced), milestones, acceptance criteria, and Definition of Done. |
| [AGENTS.md](file:///d:/Codes/Agents/Abhyas/AGENTS.md) | Agent working rules: token economy, zero dead code, automatic skill usage, and non-negotiables. |

---

## Monorepo Architecture

Abhyas is structured as a `pnpm` workspaces monorepo:

```text
/
├─ apps/
│  ├─ web/                    # React + Vite client SPA (local-first, static)
│  └─ api/                    # Optional FastAPI research service (Phase 5 only)
├─ packages/
│  ├─ core/                   # Pure TypeScript domain logic (FSM, schemas, rubrics; no DOM/React)
│  └─ content/                # Versioned question bank, skill taxonomy, and seed packs
├─ Assets/                    # Brand identity assets, logos, and favicons
└─ docs/                      # Architectural audits, privacy audits, and guides
```

---

## Prerequisites

- **Node.js:** `>= 20.12.0`
- **pnpm:** `>= 9.0.0`
- **Python:** `>= 3.11` (required only for Phase 5 backend research service)

---

## Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

> **Note:** The frontend application does not require API keys in `.env`. AI keys are configured directly by the user inside the application UI and securely stored locally in the browser.

---

## Development Roadmap

Execution proceeds sequentially according to [phases.md](file:///d:/Codes/Agents/Abhyas/phases.md):

- **Phase P0 — Foundations:** Monorepo tooling, design tokens, self-hosted typography, core contracts (`ProviderAdapter`, Dexie v1), and compliance skeleton.
- **Phase P1 — MVP Core Loop:** Settings, profile ingestion, question engine, interview runner (text and push-to-talk voice), rubric evaluation, and public static pages.
- **Phase P2 — Skills & Calibration:** Multi-session skill statistics, single-skill drills, and habit tracking.
- **Phase P3 — Local Text Mode:** In-browser WebGPU (WebLLM) and Ollama local execution.
- **Phase P4 — Company Packs:** Static company-specific question packs.
- **Phase P5 — Research Service:** Bounded, budget-capped research scraping service (FastAPI + LangGraph).
- **Phase P6 — Calendar & Review:** `.ics` roadmap schedule export and optional Google Calendar integration.
- **Phase P7 — Advanced:** Custom community packs and on-device speech recognition.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](file:///d:/Codes/Agents/Abhyas/LICENSE) for full details.  
Brand names and visual mascots are governed by [TRADEMARK.md](file:///d:/Codes/Agents/Abhyas/TRADEMARK.md).
