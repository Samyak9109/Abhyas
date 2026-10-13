# Synthesized Requirements — Abhyas

## REQ-FR-001: Local-first Persistent Storage
- source: PRD.md
- description: Store profiles, sessions, turns, rubric evaluations, skill records, and settings in browser IndexedDB via Dexie.
- acceptance: Reload preserves all data; quota exhaustion triggers clear alert; in-memory fallback operates with persistent banner warning.
- scope: storage, IndexedDB, Dexie

## REQ-FR-002: Resume Ingestion and Parsing
- source: PRD.md
- description: Ingest resume via PDF/DOCX upload or text paste, parsed entirely inside a Web Worker.
- acceptance: PDF/DOCX parsing incurs zero network requests; extracts structured skills, experiences, and education; offers inline editing.
- scope: resume parsing, web worker, pdf.js, mammoth

## REQ-FR-003: Job Description Ingestion
- source: PRD.md
- description: Ingest target job description via text paste with token budgeting and core qualification extraction.
- acceptance: Parsed client-side; cached to avoid repeated LLM calls on unchanged input; extracts requirements and focus areas.
- scope: job description, extraction, client caching

## REQ-FR-004: Target Level and Role Configuration
- source: PRD.md
- description: User selects experience level (Intern, Fresher, Mid, Senior, Lead) and target role taxonomy.
- acceptance: Calibrates question difficulty, rubric evaluation depth, and expected answer structure.
- scope: role taxonomy, difficulty calibration

## REQ-FR-005: AI Provider Configuration & Direct API Connection
- source: PRD.md
- description: Support direct client calls to Google Gemini, OpenAI, and arbitrary OpenAI-compatible endpoints with user-supplied API keys.
- acceptance: Key storage with optional WebCrypto passphrase encryption; Test Connection button with classified error feedback; zero proxying through project servers.
- scope: provider adapter, key storage, encryption, validation

## REQ-FR-006: Question Engine & Bank Selection
- source: PRD.md
- description: Question bank containing vetted questions across technical, behavioral, and HR categories, selected via seeded randomness.
- acceptance: At least 90% of questions in standard sessions originate from or anchor to vetted bank IDs; difficulty matches user level.
- scope: question bank, question selection, randomness

## REQ-FR-007: AI Question Personalization
- source: PRD.md
- description: Adapt question wording and context to user's resume projects and target job description while preserving the question's core evaluation ask.
- acceptance: Personalization preserves core evaluation intent; verified by core-ask validator; falls back to raw bank text on AI failure.
- scope: prompt engine, core-ask check, fallbacks

## REQ-FR-008: Deterministic Interview State Machine
- source: PRD.md
- description: Pure state machine controlling interview flow (Setup, Question, Listening, Transcribing, Evaluating, Follow-up, Complete, Recovery).
- acceptance: All transitions deterministic; survives provider timeout/disconnection through recovery state; no LangGraph in browser.
- scope: state machine, interview runner, packages/core

## REQ-FR-009: Speech Recognition (Voice In)
- source: PRD.md
- description: Browser Web Speech API recognition with push-to-talk, live interim transcript, and editable final text.
- acceptance: Works on desktop Chrome/Edge and Android Chrome; graceful fallback to text input on unsupported platforms; clear cloud disclosure shown when browser relies on remote STT.
- scope: voice input, Web Speech API, transcript editor

## REQ-FR-010: Speech Synthesis (Voice Out)
- source: PRD.md
- description: Browser Web Speech synthesis for AI interviewer questions, with live subtitle display and voice selection controls.
- acceptance: Subtitles match spoken text verbatim; supports pause, mute, repeat; operates without audio streaming cost.
- scope: voice output, synthesis, subtitles

## REQ-FR-011: Interview Interactive Controls
- source: PRD.md
- description: In-session controls for pause, resume, repeat question, ask for hint, skip question, and early finish.
- acceptance: Controls operate with zero state corruption; hints bounded per question; skips recorded in session summary.
- scope: interview controls, UX, state transitions

## REQ-FR-012: Rubric-Based Structured Evaluation
- source: PRD.md
- description: Multi-dimensional evaluation across Content, Structure (STAR), Technical Accuracy, and Delivery, anchored to 5 proficiency levels.
- acceptance: Evaluator uses temperature 0 and Zod schema validation; two consecutive runs differ by <= 0.5 MAE; unscored fallback on schema failure.
- scope: evaluation engine, rubrics, scoring

## REQ-FR-013: Actionable Results & Grounded Rewrites
- source: PRD.md
- description: Post-session report highlighting top 3 actionable fixes and grounded candidate answer rewrites.
- acceptance: Rewrites contain only facts present in the candidate's profile; no hallucinated experiences or metrics; clear copyable feedback.
- scope: results screen, grounded rewrites, feedback

## REQ-FR-014: Skill Taxonomy & Honest Statistics
- source: PRD.md
- description: Aggregated multi-session skill tracking across core competencies with sample-size confidence intervals.
- acceptance: Displays honest confidence bars based on question sample count; prevents premature high-mastery claims from single runs.
- scope: statistics, skill taxonomy, confidence scoring

## REQ-FR-015: Calibrated Single-Skill Drills
- source: PRD.md
- description: Focused micro-sessions practicing a single weak skill with calibrated difficulty.
- acceptance: Selects questions strictly targeting the chosen skill; provides immediate post-answer rubric feedback.
- scope: drills, single-skill practice

## REQ-FR-016: Streak & Practice Habit Tracking
- source: PRD.md
- description: Local practice habit tracking with calendar streak view and goal targets.
- acceptance: Streak computed entirely client-side; timezone-aware; immune to clock manipulation regressions.
- scope: streaks, habits, local tracking

## REQ-FR-017: Interview Calendar Integration
- source: PRD.md
- description: Preparation roadmap leading to a real interview date with .ics export and optional Google Calendar sync.
- acceptance: Standard .ics download works across all calendar apps; optional Google OAuth uses narrowest scope with in-memory token only.
- scope: calendar, .ics export, OAuth

## REQ-FR-018: Complete Data Export and Import
- source: PRD.md
- description: Full JSON export and import of user data (profiles, history, stats, settings).
- acceptance: Exported JSON validates against versioned Zod schema; import runs schema validation and migration; sensitive API keys excluded by default.
- scope: export, import, schema validation

## REQ-FR-019: Privacy-Safe Data Deletion
- source: PRD.md
- description: Granular session deletion and single-click total database wipe with typed confirmation.
- acceptance: Total wipe completely clears IndexedDB Dexie tables and local storage; verifies zero remaining state.
- scope: privacy, deletion, database reset

## REQ-FR-020: Verifiable Network Privacy & Privacy Notices
- source: PRD.md
- description: Clear disclosure of external network egress points and automated verification that user data only contacts chosen AI provider.
- acceptance: Zero analytics, telemetry, or remote crash reporting; Playwright network allowlist test asserts no foreign outbound requests.
- scope: privacy, CSP, network allowlist

## REQ-FR-021: Local In-Browser & Local Server AI Mode
- source: PRD.md
- description: Run text interviews offline via WebGPU in-browser engine (WebLLM class) or local Ollama / OpenAI-compatible REST server.
- acceptance: PC-only text mode; pre-flight VRAM/hardware check; zero network requests during local inference.
- scope: local models, WebGPU, Ollama

## REQ-FR-022: Company Interview Packs
- source: PRD.md
- description: Curated and static company packs providing company-specific interview style, typical questions, and culture cues.
- acceptance: Packs strictly follow JSON schema with required source citations; loaded from local content package or static mirror.
- scope: company packs, static mirror, citations

## REQ-FR-023: Company Research Service (Backend)
- source: PRD.md
- description: Optional Phase 5 FastAPI backend running a bounded LangGraph scraping pipeline for on-demand company pack generation.
- acceptance: Operates behind hard daily/monthly budgets; server API key never proxies user interview prompts; outputs reviewed static packs.
- scope: FastAPI, LangGraph, research pipeline

## REQ-FR-024: AI Usage Caps & Cost Estimator
- source: PRD.md
- description: Client-side token and cost estimator with hard session caps to prevent accidental billing runaway.
- acceptance: Shows estimated cost per session before starting; automatically halts runaway loops if token limit is exceeded.
- scope: cost estimator, token caps, safety guardrails

## REQ-FR-025: Prerendered Static Public Site & Documentation
- source: PRD.md
- description: Public pages (Landing PG-01, Privacy PG-02, Open Source PG-03, Key Guide PG-04, Troubleshooting PG-05, Error/Offline PG-08).
- acceptance: Prerendered static HTML; zero third-party requests; matches approved retro-pixel design and typography; full WCAG 2.2 AA accessibility.
- scope: public pages, static prerendering, SEO
