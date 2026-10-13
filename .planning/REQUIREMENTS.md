# Requirements: Abhyas

## Requirements List

### Storage & Data Management
- [ ] **STOR-01**: Local-first IndexedDB storage via Dexie (v1 schema) for profiles, sessions, turns, and skills (FR-001).
- [ ] **STOR-02**: Complete JSON export and import with versioned Zod schema validation (FR-018).
- [ ] **STOR-03**: Granular session deletion and single-click total database wipe with typed confirmation (FR-019).

### Profile & Document Ingestion
- [ ] **PROF-01**: PDF and DOCX resume parsing executed entirely inside a Web Worker without network requests (FR-002).
- [ ] **PROF-02**: Job description text ingestion with token budgeting and cached key requirement extraction (FR-003).
- [ ] **PROF-03**: Role and experience level calibration (Intern, Fresher, Mid, Senior, Lead) (FR-004).

### AI Providers & Connectivity
- [ ] **PROV-01**: Direct browser calls to Google Gemini, OpenAI, and OpenAI-compatible endpoints with user API keys (FR-005).
- [ ] **PROV-02**: Local key storage with optional WebCrypto passphrase encryption and classified error diagnostics (FR-005).
- [ ] **PROV-03**: Client-side token and cost estimator with hard session caps to prevent billing runaway (FR-024).

### Question Engine & Personalization
- [ ] **QUES-01**: Vetted question bank across technical, behavioral, and HR categories selected via seeded randomness (FR-006).
- [ ] **QUES-02**: AI question personalization adapting to candidate resume projects while strictly preserving core evaluation ask (FR-007).

### Interview Runner & Controls
- [ ] **FSM-01**: Pure, deterministic interview state machine in `packages/core` with recovery states (FR-008).
- [ ] **FSM-02**: Interactive interview controls (pause, resume, repeat, hint, skip, early finish) (FR-011).

### Voice & Speech
- [ ] **VOIC-01**: Push-to-talk browser Web Speech recognition with live interim transcript and editable final text (FR-009).
- [ ] **VOIC-02**: Browser Web Speech synthesis for AI questions with synchronized subtitles and mute/repeat controls (FR-010).

### Rubric Evaluation & Results
- [ ] **EVAL-01**: Multi-dimensional rubric evaluation across Content, STAR Structure, Technical Accuracy, and Delivery with level anchors (FR-012).
- [ ] **EVAL-02**: Temperature 0 evaluation with Zod schema validation and <= 0.5 MAE reproducibility (FR-012).
- [ ] **EVAL-03**: Results view with top 3 actionable fixes and grounded candidate answer rewrites (FR-013).

### Skills, Analytics & Habits
- [ ] **STAT-01**: Aggregated multi-session skill statistics with honest confidence intervals (FR-014).
- [ ] **STAT-02**: Focused single-skill drills with calibrated difficulty (FR-015).
- [ ] **STAT-03**: Client-side practice streak and habit tracking (FR-016).

### Local Offline Mode
- [ ] **LOCL-01**: In-browser WebGPU engine (WebLLM class) for offline text interviews on PC (FR-021).
- [ ] **LOCL-02**: Local Ollama and OpenAI-compatible server endpoint integration (FR-021).

### Company Packs & Research Service
- [ ] **PACK-01**: Curated static company interview packs with evidence-backed questions and static CDN mirror (FR-022).
- [ ] **PACK-02**: Optional Phase 5 FastAPI + LangGraph scraping backend with budget caps (FR-023).

### Calendar Integration
- [ ] **CAL-01**: `.ics` prep roadmap export and optional client-side Google Calendar integration (FR-017).

### Public Site & Platform Quality
- [ ] **SITE-01**: Prerendered static public pages (Landing, Privacy, Open Source, Key Guide, Troubleshooting, Offline shells) (FR-025).
- [ ] **QUAL-01**: Strict Content Security Policy and automated Playwright network allowlist test asserting zero unauthorized egress (NFR-006, NFR-017).
- [ ] **QUAL-02**: Retro-pixel design system with 4 self-hosted Latin-subset fonts and full WCAG 2.2 AA accessibility (NFR-022, NFR-025).
- [ ] **QUAL-03**: Zero dead code, unused exports, or dead dependencies enforced by Knip (NFR-015).

---

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| STOR-01 | Phase 1 (M1.1) | Pending |
| STOR-02 | Phase 1 (M1.1) | Pending |
| STOR-03 | Phase 1 (M1.1) | Pending |
| PROF-01 | Phase 1 (M1.3) | Pending |
| PROF-02 | Phase 1 (M1.3) | Pending |
| PROF-03 | Phase 1 (M1.3) | Pending |
| PROV-01 | Phase 1 (M1.2) | Pending |
| PROV-02 | Phase 1 (M1.2) | Pending |
| PROV-03 | Phase 1 (M1.2) | Pending |
| QUES-01 | Phase 1 (M1.4) | Pending |
| QUES-02 | Phase 1 (M1.4) | Pending |
| FSM-01 | Phase 1 (M1.5) | Pending |
| FSM-02 | Phase 1 (M1.5) | Pending |
| VOIC-01 | Phase 1 (M1.6) | Pending |
| VOIC-02 | Phase 1 (M1.6) | Pending |
| EVAL-01 | Phase 1 (M1.7) | Pending |
| EVAL-02 | Phase 1 (M1.7) | Pending |
| EVAL-03 | Phase 1 (M1.7) | Pending |
| STAT-01 | Phase 2 | Pending |
| STAT-02 | Phase 2 | Pending |
| STAT-03 | Phase 2 | Pending |
| LOCL-01 | Phase 3 | Pending |
| LOCL-02 | Phase 3 | Pending |
| PACK-01 | Phase 4 | Pending |
| PACK-02 | Phase 5 | Pending |
| CAL-01 | Phase 6 | Pending |
| SITE-01 | Phase 1 (M1.9) | Pending |
| QUAL-01 | Phase 0 (M0.5) / Phase 1 (M1.8) | Pending |
| QUAL-02 | Phase 0 (M0.2) | Pending |
| QUAL-03 | Phase 0 (M0.1) | Pending |
