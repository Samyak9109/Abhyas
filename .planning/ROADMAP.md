# Roadmap: Abhyas

## Phases

- [x] **Phase 0: Foundations** - Scaffolding pnpm monorepo, strict TypeScript, design tokens, self-hosted typography, core contracts, and CI pipeline (completed 2026-10-13)
- [ ] **Phase 1: MVP Core Loop & Public Site** - End-to-end voice and text mock interview practice, rubric evaluations, actionable rewrites, and prerendered static public pages (Exit Gate G1)
- [ ] **Phase 2: Skills & Calibration** - Multi-session skill tracking, confidence intervals, single-skill drills, and habit tracking
- [ ] **Phase 3: Local Text Mode** - In-browser WebGPU (WebLLM) and Ollama local execution for offline interview practice
- [ ] **Phase 4: Company Packs (Static)** - Curated static JSON company interview packs with evidence-backed questions
- [ ] **Phase 5: Research Service** - Bounded FastAPI + LangGraph scraping backend with hard budget caps for on-demand company packs
- [ ] **Phase 6: Calendar & Review** - Interview preparation schedule `.ics` export and optional Google Calendar OAuth integration
- [ ] **Phase 7: Advanced** - Community custom packs and on-device Whisper speech recognition

---

## Phase Details

### Phase 0: Foundations
**Goal**: Establish a bulletproof, framework-free core and monorepo baseline so later phases move rapidly without architectural drift.  
**Depends on**: Nothing (first phase)  
**Requirements**: QUAL-01, QUAL-02, QUAL-03  
**Success Criteria** (what must be TRUE):
  1. Monorepo builds cleanly with pnpm workspaces (`apps/web`, `packages/core`, `packages/content`).
  2. Package boundary linting enforces that `packages/core` imports nothing from React or browser DOM.
  3. All 4 approved fonts (`Pixelify Sans`, `Instrument Sans`, `JetBrains Mono`, `Caveat`) are self-hosted Latin-subset woff2 files with zero CDN requests.
  4. Design tokens render all states across dark Ink and light Paper themes, verified by automated axe accessibility tests.
  5. Core contracts (`ProviderAdapter`, Dexie schema v1, Zod validation schemas) pass contract test harness with recorded fixtures.
  6. CI pipeline runs automated checks for dead code and unused dependencies via Knip.
**Plans**: TBD  
**UI hint**: yes

### Phase 1: MVP Core Loop & Public Site
**Goal**: Validate core value hypothesis: candidates can configure API keys, practice realistic mock interviews by voice or text, and receive actionable, grounded feedback.  
**Depends on**: Phase 0  
**Requirements**: STOR-01, STOR-02, STOR-03, PROF-01, PROF-02, PROF-03, PROV-01, PROV-02, PROV-03, QUES-01, QUES-02, FSM-01, FSM-02, VOIC-01, VOIC-02, EVAL-01, EVAL-02, EVAL-03, SITE-01  
**Success Criteria** (what must be TRUE):
  1. A candidate can upload/paste a resume and job description, parsed securely in a Web Worker with zero network egress.
  2. Candidate can connect their Google Gemini or OpenAI key directly, tested with classified error diagnostics.
  3. Candidate can complete a full 5-question interview session via push-to-talk voice or text input, managed by the deterministic state machine.
  4. Rubric evaluation outputs multi-dimensional scores (Content, STAR Structure, Technical Accuracy, Delivery) with <= 0.5 MAE reproducibility at temperature 0.
  5. Results screen presents top 3 actionable fixes and grounded candidate answer rewrites with zero hallucinated claims.
  6. Prerendered static public pages (Landing, Privacy, Open Source, Key Guide, Troubleshooting, Offline shell) load with zero third-party requests.
  7. Passes Exit Gate G1 user validation (70% reach first question in < 3 min; >= 70% rate feedback useful).
**Plans**: TBD  
**UI hint**: yes

### Phase 2: Skills & Calibration
**Goal**: Deliver long-term practice value through honest skill statistics, level-calibrated difficulty, and habit formation.  
**Depends on**: Phase 1  
**Requirements**: STAT-01, STAT-02, STAT-03  
**Success Criteria** (what must be TRUE):
  1. Candidate can view an honest skills dashboard displaying confidence intervals based on question sample size.
  2. Candidate can launch a single-skill drill with calibrated difficulty targeting their weakest competency.
  3. Practice streaks and milestones track locally without server dependencies or clock skew vulnerabilities.
**Plans**: TBD  
**UI hint**: yes

### Phase 3: Local Text Mode
**Goal**: Provide a completely private, offline interview experience on supported PCs without requiring API keys or cloud connections.  
**Depends on**: Phase 2  
**Requirements**: LOCL-01, LOCL-02  
**Success Criteria** (what must be TRUE):
  1. WebGPU hardware capability probe validates PC compatibility and memory headroom before downloading model weights.
  2. Text interview executes locally in-browser via WebLLM with zero outbound network requests during inference.
  3. Candidate can alternately connect to a local Ollama or OpenAI-compatible server endpoint.
**Plans**: TBD

### Phase 4: Company Packs (Static)
**Goal**: Allow candidates to practice against curated, evidence-backed company interview formats and question styles.  
**Depends on**: Phase 2  
**Requirements**: PACK-01  
**Success Criteria** (what must be TRUE):
  1. Curated company packs load from the local content package or static CDN mirror.
  2. Pack questions strictly validate against Zod schemas and require verifiable source citations.
**Plans**: TBD

### Phase 5: Research Service
**Goal**: Provide an automated, budget-bounded backend pipeline for generating on-demand company research packs.  
**Depends on**: Phase 4  
**Requirements**: PACK-02  
**Success Criteria** (what must be TRUE):
  1. FastAPI service runs bounded LangGraph scraping pipeline respecting hard daily ($5.00) and monthly budget caps.
  2. Safe fetcher enforces SSRF protections, blocks private IP ranges, and strips scripts/comments.
  3. Pipeline outputs validated static JSON packs to the static mirror; server AI key never touches candidate prompts.
**Plans**: TBD

### Phase 6: Calendar & Review
**Goal**: Help candidates build a structured preparation schedule leading up to real interview dates.  
**Depends on**: Phase 2  
**Requirements**: CAL-01  
**Success Criteria** (what must be TRUE):
  1. Candidate can export an interview preparation roadmap as a standard `.ics` calendar file.
  2. Optional client-side Google Calendar integration adds study blocks using in-memory OAuth tokens.
**Plans**: TBD  
**UI hint**: yes

### Phase 7: Advanced Features
**Goal**: Support power-user workflows and edge-tier hardware enhancements.  
**Depends on**: Phase 3, Phase 6  
**Requirements**: Custom packs, on-device Whisper  
**Success Criteria** (what must be TRUE):
  1. Users can import custom company packs with format verification.
  2. On-device Whisper speech recognition runs locally on high-end hardware.
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| Phase 0: Foundations | 5/5 | Complete (exit gate passed; re-verified 2026-10-14) | 2026-10-13 |
| Phase 1: MVP Core Loop & Public Site | 0/9 | Not started | - |
| Phase 2: Skills & Calibration | 0/3 | Not started | - |
| Phase 3: Local Text Mode | 0/2 | Not started | - |
| Phase 4: Company Packs (Static) | 0/2 | Not started | - |
| Phase 5: Research Service | 0/3 | Not started | - |
| Phase 6: Calendar & Review | 0/2 | Not started | - |
| Phase 7: Advanced | 0/2 | Not started | - |
