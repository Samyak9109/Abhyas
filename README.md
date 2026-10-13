<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="Assets/svg/abhyas-lockup-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="Assets/svg/abhyas-lockup.svg">
  <img alt="Abhyas — Local-First AI Interview Practice" src="Assets/svg/abhyas-lockup.svg" width="380">
</picture>

<p align="center">
  <strong>अभ्यास</strong> • <em>/ʌb.hjɑːs/</em> — <em>"deliberate, feedback-rich practice"</em>
</p>

<p align="center">
  <strong>A free, private, local-first web application for practicing job interviews out loud with an AI interviewer calibrated to your resume, job description, and company culture.</strong>
</p>

<p align="center">
  <a href="https://github.com/Samyak9109/Abhyas/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript Strict"></a>
  <a href="https://dexie.com/"><img src="https://img.shields.io/badge/storage-IndexedDB%20%2F%20Dexie-14213D?style=flat-square" alt="Local-First Dexie"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API"><img src="https://img.shields.io/badge/voice-Web%20Speech%20API-FCA311?style=flat-square" alt="Web Speech API"></a>
  <a href="https://www.w3.org/WAI/standards-guidelines/wcag/"><img src="https://img.shields.io/badge/accessibility-WCAG%202.2%20AA-success?style=flat-square" alt="WCAG 2.2 AA"></a>
  <a href="https://github.com/Samyak9109/Abhyas/blob/main/phases.md"><img src="https://img.shields.io/badge/status-Phase%200%3A%20Foundations-informational?style=flat-square" alt="Status: Phase 0 Foundations"></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#the-problem--the-solution">Problem & Solution</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#security--privacy-invariants">Security & Privacy</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#author">Author</a>
</p>

---

<picture>
  <img alt="Abhyas Visual Preview Banner" src="Assets/png/abhyas-og-1200x630.png" width="800">
</picture>

</div>

---

## Overview

Most candidates lack access to realistic, feedback-rich interview coaching. Generic chatbots offer text conversation without out-loud speaking practice, while commercial interview prep services frequently lock users behind expensive monthly subscriptions, harvest candidate resumes onto cloud databases, and enforce proprietary vendor lock-in.

**Abhyas** is engineered around an uncompromising **local-first, privacy-by-design architecture**:

- **Absolute Data Sovereignty:** Candidate resumes, job descriptions, answers, transcripts, and evaluation scorecards are stored strictly inside your browser (`IndexedDB` via Dexie). There are zero user accounts, tracking cookies, or central analytics servers.
- **Direct Provider Connectivity:** Your browser connects directly to your chosen AI provider (Google Gemini, OpenAI, or compatible local/cloud endpoints) using your own API key. Keys can be WebCrypto-encrypted locally and never touch any project proxy server.
- **Offline & Local Text Mode:** Run text mock interviews completely offline using in-browser WebGPU models (WebLLM) or local Ollama servers without an internet connection.
- **Objective, Reproducible Feedback:** Multi-dimensional rubric evaluations (STAR structure, technical depth, delivery clarity) evaluated at temperature 0 with strict schema validation. Candidate answer rewrites are grounded strictly in profile facts and never hallucinate qualifications.
- **Retro-Pixel Aesthetics:** High-contrast, keyboard-accessible "Ink" and "Paper" visual language with self-hosted typography and zero CDN dependencies.

---

## The Problem → The Solution

### The Problem
1. **No Speaking Practice:** Reading question banks or typing to chatbots fails to build vocal delivery, conciseness, and composure under pressure.
2. **Surveillance & Data Exploitation:** Commercial prep tools upload sensitive resumes, work histories, and raw audio recordings to vendor servers for AI training.
3. **Hallucinatory Feedback:** Generic chat models praise flawed answers or invent imaginary metrics in suggested rewrites, degrading candidate preparation.
4. **Vendor Lock-in & Paywalls:** Candidates are locked into proprietary platforms with recurring subscription fees for basic practice sessions.

### The Solution
Abhyas decouples candidate practice from vendor infrastructure:
- **Push-to-Talk Voice In, Spoken Audio Out:** Browser-native speech recognition lets candidates answer out loud and edit transcripts before scoring.
- **Zero-Backend Client Core:** The entire interview lifecycle runs client-side in `packages/core` via a deterministic state machine.
- **Evidence-Grounded Rubrics:** Candidate responses are evaluated against fixed 5-level anchor rubrics; suggestions must trace directly to resume evidence.
- **Model Freedom:** Bring any API key or run completely offline with open-weight local models.

---

## Architecture

Abhyas operates as a local-first client Single Page Application with framework-free domain logic:

```mermaid
flowchart TB
    subgraph Client["Candidate Device (Browser SPA — Local-First)"]
        direction TB
        UI["React 18/19 Client SPA<br/>(apps/web)"]
        Worker["Document Ingestion Worker<br/>(pdf.js & mammoth)"]
        FSM["Deterministic Interview FSM<br/>(packages/core)"]
        Speech["Browser Web Speech API<br/>(STT & TTS)"]
        DB[("IndexedDB via Dexie<br/>• Profiles • Sessions<br/>• Rubrics • WebCrypto Keys")]
        WebLLM["In-Browser WebGPU Engine<br/>(Phase 3 Local Mode)"]
    end

    subgraph DirectCloud["Candidate AI Provider (Direct Browser Calling)"]
        Gemini["Google Gemini API"]
        OpenAI["OpenAI / Compatible Endpoint"]
        Ollama["Local Ollama Server"]
    end

    subgraph OptionalBackend["Optional Backend (Phase 5 Only)"]
        FastAPI["Research Service API<br/>(apps/api)"]
        Mirror[("Static Pack Mirror<br/>(Curated CDN)")]
    end

    UI -->|Upload Resume / Job Description| Worker
    Worker -->|Structured Text (Zero Network)| DB
    UI -->|Session Interaction| FSM
    UI -->|Push-to-Talk Speech| Speech
    Speech -->|Editable Transcript| FSM
    FSM -->|Persist Turns & Scores| DB
    FSM -->|Direct Prompts with User Key| Gemini
    FSM -->|Direct Prompts with User Key| OpenAI
    FSM -->|Local Inference| WebLLM
    FSM -->|Localhost HTTP| Ollama
    UI -.->|Company Demand Signals Only| FastAPI
    UI -.->|Fetch Static Company Packs| Mirror
```

### Core Architectural Invariants

1. **Local-First & Accountless ([ADR-001](file:///d:/Codes/Agents/Abhyas/architecture.md)):** User data never leaves the browser. No account database exists.
2. **Direct Provider Calls ([ADR-002](file:///d:/Codes/Agents/Abhyas/architecture.md)):** The client communicates directly with provider endpoints using candidate keys. The project never proxies interview traffic.
3. **Deterministic State Machine ([ADR-007](file:///d:/Codes/Agents/Abhyas/architecture.md)):** Interview flow is governed by a pure, testable finite state machine in `packages/core`. The AI model generates response text and scores only.
4. **Framework-Free Domain Core ([ADR-016](file:///d:/Codes/Agents/Abhyas/architecture.md)):** `packages/core` contains pure TypeScript domain logic and schemas with zero imports from React, ReactDOM, or browser DOM.
5. **Self-Hosted Typography ([ADR-020](file:///d:/Codes/Agents/Abhyas/architecture.md)):** All 4 approved fonts are self-hosted Latin-subset `.woff2` files to prevent IP address leakage to font CDNs.

---

## Key Features

| Capability | What It Delivers | Technical Implementation |
| --- | --- | --- |
| **Push-to-Talk Voice Practice** | Speak answers naturally; review and edit transcripts before submitting to eliminate voice recognition mistakes. | Browser Web Speech API (`SpeechRecognition` & `SpeechSynthesis`) behind replaceable interfaces. |
| **Local-First Document Ingestion** | Extract qualifications and skills from PDF/DOCX resumes and job descriptions privately. | Dedicated Web Worker using `pdf.js` and `mammoth`; zero network requests during document parsing. |
| **Deterministic Interview FSM** | Reliable interview pacing, follow-up probes (max 2 per question), hints, pauses, and graceful failure recovery. | Pure TypeScript finite state machine in `packages/core` with illegal transition rejections. |
| **STAR Rubric Evaluation** | Multi-dimensional scoring across Content, STAR Structure, Technical Accuracy, and Delivery with level anchors. | Temperature 0 evaluation verified by Zod schemas; <= 0.5 MAE score reproducibility across runs. |
| **Grounded Answer Rewrites** | Concrete, copyable answer improvements that strictly reference verifiable candidate profile facts. | Core-ask validator and anti-hallucination prompt boundaries (zero invented projects or metrics). |
| **Honest Skill Analytics** | Multi-session competency tracking with honest confidence intervals reflecting question sample counts. | Statistical aggregation in `packages/core`; prevents premature high-mastery claims from single runs. |
| **Offline Local Mode** | Practice completely offline on supported PCs without cloud API keys. | In-browser WebGPU inference (WebLLM class) and local Ollama REST server integration. |
| **Retro-Pixel Aesthetics** | Distinctive, high-contrast visual design with dark Ink (default) and light Paper themes. | Semantic CSS tokens, pixel monitor-head interviewer mascot, and full WCAG 2.2 AA accessibility. |

---

## How It Works

```text
[1. Connect AI Provider] ──► [2. Parse Profile & JD] ──► [3. Question Selection]
     Gemini / OpenAI /             Web Worker extracts text;        Seeded randomness picks
     Ollama / WebGPU               cached by content hash           from vetted question bank
                                                                               │
[6. Results & Scorecard] ◄── [5. Rubric Evaluation] ◄── [4. Live Voice Turn] ◄─┘
     Top 3 priority fixes;         Temperature 0 scoring            Push-to-talk speech;
     grounded STAR rewrites        across 4 STAR dimensions         editable live transcript
```

1. **Configure AI Source:** Connect your Gemini or OpenAI API key (encrypted locally with WebCrypto) or toggle local offline mode.
2. **Ingest Profile & Role:** Upload your resume (PDF/DOCX) and paste the job description. The Web Worker parses them locally without network calls, synthesizing a condensed `StructuredProfile` (<= 1,200 tokens).
3. **Question Selection:** The engine selects vetted questions from `packages/content` matching your role and level band, personalizing wording to your resume while preserving the core evaluation ask.
4. **Live Interview Session:** The interviewer speaks the question with synchronized subtitles. Answer out loud using push-to-talk, edit the interim transcript if needed, and submit.
5. **Rubric Evaluation:** Answers are scored at temperature 0 against 5-level rubric anchors (Content, STAR Structure, Technical Depth, Delivery).
6. **Actionable Scorecard:** Receive immediate feedback highlighting top fixes and grounded candidate rewrites, stored locally in IndexedDB.

---

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Client Framework** | React 18/19 + Vite | Fast, modern client-side Single Page Application (`apps/web`) |
| **Styling & Design System** | Tailwind CSS + CSS Custom Properties | Semantic design tokens from `design.md` supporting Ink and Paper themes |
| **UI Component Primitives** | shadcn/ui primitives | Accessible dialogs, disclosures, tabs, and switches |
| **Client State Management** | Zustand | Lightweight client UI state management |
| **Core Domain Package** | Pure TypeScript (Strict) | Framework-free interview FSM, question selection, rubrics (`packages/core`) |
| **Client Storage** | IndexedDB via Dexie | Persistent browser storage with schema migrations and transactions |
| **Data Validation** | Zod | Runtime schema validation for all stored data, imports, and AI outputs |
| **Document Processing** | pdf.js & mammoth | Client-side resume parsing inside Web Workers |
| **Audio & Speech** | Browser Web Speech API | Push-to-talk speech recognition and synthesized question voice |
| **Local Inference (Phase 3)** | WebGPU (WebLLM) & Ollama | Offline local text execution on supported hardware |
| **Testing & Verification** | Vitest, Playwright, axe-core, Knip | Unit tests, network egress allowlist tests, WCAG accessibility, and dead-code checks |
| **Backend (Phase 5)** | FastAPI, Python 3.11, PostgreSQL, LangGraph | Optional, budget-capped company pack research pipeline (`apps/api`) |
| **Typography** | Pixelify Sans, Instrument Sans, JetBrains Mono, Caveat | 4 locked self-hosted Latin-subset woff2 typefaces (zero CDN calls) |

---

## Project Structure

Abhyas is structured as a `pnpm` workspaces monorepo:

```text
Abhyas/
├── apps/
│   ├── web/                    # React + Vite client SPA (local-first)
│   │   ├── src/
│   │   │   ├── app/            # App shell, routing, global providers
│   │   │   ├── components/     # Design token UI primitives (Button, Input, Dialog, etc.)
│   │   │   ├── features/       # Feature modules (setup, interview, results, stats, settings)
│   │   │   ├── pages/          # Prerendered public marketing pages (PG-01 to PG-08)
│   │   │   ├── workers/        # Document parsing Web Workers (pdf.js, mammoth)
│   │   │   ├── styles/         # tokens.css (CSS custom properties) and global styles
│   │   │   └── fonts/          # Self-hosted woff2 font files
│   │   └── .env.example        # Client environment template
│   └── api/                    # Optional Phase 5 FastAPI research backend
│       ├── app/                # Routes, LangGraph pipeline, database client
│       └── .env.example        # Backend research service template
├── packages/
│   ├── core/                   # Pure TypeScript domain logic (no React, no DOM)
│   │   └── src/
│   │       ├── interview/      # Deterministic interview state machine and runner
│   │       ├── providers/      # ProviderAdapter interfaces (Gemini, OpenAI, Mock)
│   │       ├── questions/      # Question selection engine and core-ask validator
│   │       ├── rubric/         # Multi-dimensional rubric evaluator and score math
│   │       ├── skills/         # Skill taxonomy and confidence interval statistics
│   │       └── schemas/        # Shared Zod validation schemas
│   └── content/                # Versioned static data packages
│       ├── questions/          # Question bank JSON records
│       ├── rubrics/            # Level-anchored rubrics
│       └── taxonomy/           # Skill competency hierarchy
├── Assets/                     # Brand identity lockups, marks, favicons, and banners
├── docs/                       # Architectural decision records and privacy audits
├── .planning/                  # GSD roadmap, state memory, requirements, and codebase map
├── PRD.md                      # Governing requirements document (Authority level 1)
├── architecture.md             # System architecture & ADR log (Authority level 2)
├── design.md                   # Design specifications & tokens (Authority level 3)
├── phases.md                   # Execution schedule & milestones (Authority level 4)
└── AGENTS.md                   # Agent guidelines & non-negotiables
```

---

## Getting Started

### Prerequisites

- **Node.js:** `>= 20.12.0` (LTS)
- **pnpm:** `>= 9.0.0`
- **Python:** `>= 3.11` *(required only for Phase 5 backend research service)*

### 1. Clone the Repository

```bash
git clone https://github.com/Samyak9109/Abhyas.git
cd Abhyas
```

### 2. Environment Setup

Copy the example environment configuration:

```bash
cp .env.example .env
```

> **Note on Client Secrets:** The client web application does **not** store AI API keys in `.env`. Keys are entered directly by the candidate in the browser settings and stored encrypted in IndexedDB.

### 3. Install Monorepo Dependencies

```bash
pnpm install
```

### 4. Development Commands

```bash
# Run web application in development mode
pnpm dev

# Run unit and contract test suites
pnpm test

# Run strict TypeScript type checks
pnpm typecheck

# Run linter and import-boundary checks
pnpm lint

# Run dead-code and unused-dependency checks
pnpm knip

# Build all applications and packages for production
pnpm build
```

---

## Configuration

| Variable | Scope | Required | Description |
| --- | --- | :---: | --- |
| `VITE_APP_NAME` | Client | No | Application branding name (default: `"Abhyas"`). |
| `VITE_API_URL` | Client | No | Optional Phase 5 research backend URL (default: `"http://localhost:8000"`). |
| `VITE_STATIC_PACKS_URL` | Client | No | Optional static CDN mirror URL for curated company packs. |
| `PORT` | Backend (P5) | No | Port for FastAPI service (default: `8000`). |
| `DATABASE_URL` | Backend (P5) | Yes (P5) | PostgreSQL connection string for company research caching. |
| `PROJECT_AI_PROVIDER` | Backend (P5) | Yes (P5) | Backend research provider (`"gemini"` or `"openai"`). Never proxies user interviews. |
| `PROJECT_AI_API_KEY` | Backend (P5) | Yes (P5) | Server-side API key used strictly for public company research. |
| `DAILY_BUDGET_CENTS` | Backend (P5) | Yes (P5) | Hard daily spend cap in cents (default: `500` = $5.00). |
| `MONTHLY_BUDGET_CENTS` | Backend (P5) | Yes (P5) | Hard monthly spend cap in cents (default: `10000` = $100.00). |
| `TURNSTILE_SECRET_KEY` | Backend (P5) | No | Cloudflare Turnstile anti-bot secret for public demand request endpoints. |

---

## Security & Privacy Invariants

Abhyas enforces concrete, auditable privacy guarantees:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA PRIVACY INVARIANTS                         │
├────────────────────────────────┬───────────────────────────────────────┤
│ Data Category                  │ Storage & Transmission Boundary       │
├────────────────────────────────┼───────────────────────────────────────┤
│ Resumes & Job Descriptions     │ Stored strictly in browser IndexedDB. │
│                                │ Never sent to project servers.        │
├────────────────────────────────┼───────────────────────────────────────┤
│ Audio & Voice Transcripts      │ Speech recognition processed locally; │
│                                │ transcripts stored in IndexedDB.      │
├────────────────────────────────┼───────────────────────────────────────┤
│ User AI Provider API Keys      │ Stored in browser IndexedDB with      │
│                                │ optional WebCrypto AES-GCM encryption.│
│                                │ Transmitted ONLY to provider origin.  │
├────────────────────────────────┼───────────────────────────────────────┤
│ Telemetry & Analytics          │ ZERO telemetry, tracking cookies, or  │
│                                │ remote crash reporting.               │
├────────────────────────────────┼───────────────────────────────────────┤
│ Network Egress Control         │ Outbound connections locked by CSP    │
│                                │ and validated by Playwright tests.    │
└────────────────────────────────┴───────────────────────────────────────┘
```

- **Content Security Policy:** Script and font sources are locked to `'self'`. Fonts are self-hosted with zero Google Font CDN requests.
- **Prompt Injection Mitigations:** Candidate inputs and resumes are isolated within XML-delimited boundaries in prompts; outputs are restricted to strict JSON schemas.
- **Safe Data Destruction:** Single-click total database wipe with typed confirmation completely purges all IndexedDB Dexie tables and local storage.

---

## Roadmap

Execution follows the phased schedule detailed in [phases.md](file:///d:/Codes/Agents/Abhyas/phases.md) and [.planning/ROADMAP.md](file:///d:/Codes/Agents/Abhyas/.planning/ROADMAP.md):

- [x] **Pre-Initialization & Specification Contracts:** Complete PRD, system architecture, retro-pixel design tokens, and GSD planning artifacts established.
- [ ] **Phase 0: Foundations** — pnpm monorepo scaffolding (`apps/web`, `packages/core`, `packages/content`), strict TypeScript, design tokens, self-hosted typography, Dexie schema v1, and CI/CD pipeline. *(Current Phase)*
- [ ] **Phase 1: MVP Core Loop & Public Site** — Resume/JD Web Worker ingestion, deterministic FSM interview runner, push-to-talk voice, STAR rubric evaluation, actionable rewrites, and prerendered static public pages. *(Exit Gate G1 Validation)*
- [ ] **Phase 2: Skills & Calibration** — Multi-session skill tracking, confidence intervals, single-skill drills, and habit streak tracking.
- [ ] **Phase 3: Local Text Mode** — In-browser WebGPU (WebLLM) inference and local Ollama server integration for offline interview practice.
- [ ] **Phase 4: Company Packs (Static)** — Curated static JSON company interview packs with evidence-backed questions.
- [ ] **Phase 5: Research Service** — Optional FastAPI + LangGraph scraping backend with hard daily/monthly budget caps.
- [ ] **Phase 6: Calendar & Preparation Planning** — `.ics` roadmap schedule export and optional client-side Google Calendar integration.
- [ ] **Phase 7: Advanced Features** — Custom community packs and on-device Whisper speech recognition.

---

## Contributing

Contributions are welcome. Please read [AGENTS.md](file:///d:/Codes/Agents/Abhyas/AGENTS.md) and [architecture.md](file:///d:/Codes/Agents/Abhyas/architecture.md) before submitting code.

1. **Fork the Repository**
2. **Create a Feature Branch:** `git checkout -b feature/issue-id-description`
3. **Trace Every Change:** Tag commits and code comments to requirement IDs (e.g. `// FR-012`)
4. **Enforce Zero Dead Code:** Ensure `pnpm knip` and `pnpm lint` pass cleanly with no unused exports or dead dependencies
5. **Verify Accessibility & Tests:** Ensure `pnpm test` passes and axe accessibility checks remain clean
6. **Commit with Conventional Commits:** `git commit -m "feat(core): implement rubric evaluator schema"`
7. **Submit a Pull Request**

---

## License & Trademark

- **Code:** Licensed under the **[MIT License](file:///d:/Codes/Agents/Abhyas/LICENSE)**. Copyright © 2026 Samyak Jain.
- **Brand & Mascot:** The name "Abhyas" and the pixel monitor-head mascot visual assets are protected trademarks governed by **[TRADEMARK.md](file:///d:/Codes/Agents/Abhyas/TRADEMARK.md)**.

---

## Author

<table border="0">
  <tr>
    <td width="80" align="center" valign="middle">
      <img src="https://github.com/Samyak9109.png" width="70" height="70" style="border-radius:50%;" alt="Samyak Jain">
    </td>
    <td valign="middle">
      <strong>Samyak Jain</strong><br/>
      <em>Creator & Maintainer of Abhyas</em><br/>
      <a href="https://github.com/Samyak9109"><img src="https://img.shields.io/badge/GitHub-Samyak9109-181717?style=flat-square&logo=github" alt="GitHub"></a>
      <a href="https://www.linkedin.com/in/samyak-jain-122aaa273/"><img src="https://img.shields.io/badge/LinkedIn-Samyak%20Jain-0A66C2?style=flat-square&logo=linkedin" alt="LinkedIn"></a>
    </td>
  </tr>
</table>

<div align="center">
  <sub>Built with care for candidates seeking private, feedback-rich interview practice.</sub>
</div>
