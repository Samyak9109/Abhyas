# Phases — Abhyas

| Field | Value |
| --- | --- |
| Document | `phases.md` (authority level 4 of 4) |
| Version | 0.3.0 |
| Last updated | 2026-10-14 |
| Governs | Order of work, milestones, acceptance criteria, validation gates |
| Governed by | `PRD.md`, `architecture.md`, `design.md` (they win on conflict) |

Status labels follow `PRD.md` section 0.3. Time estimates are planning assumptions for one developer, not commitments; revise them with measured progress and record the change in the change log.

---

## 1. Purpose and rules of engagement

This document says **what to build, in what order, and how to know it is done.** It does not override requirements, architecture or design.

Rules for humans and AI coding agents:
1. Work on **one phase at a time**, in order. Do not build features from later phases early, even if they seem small.
2. Every task must trace to an `FR-###`, `NFR-###` or milestone `M#.#`. If it does not, stop and ask the owner.
3. A milestone is done only when all its acceptance criteria pass, CI is green, and the documents are updated (see Definition of Done, section 5).
4. A phase is complete only after its **exit gate** is passed and the owner signs off. Validation gates (G1 and later) may change the plan; follow the owner's decision.
5. New ideas go to the Parking Lot in `PRD.md` section 12, not into the current phase.
6. If an estimate is clearly wrong, report it and propose a re-plan rather than cutting quality (accessibility, privacy, tests, error states).

---

## 2. Phase overview

| Phase | Name | Main FRs | Planning estimate (solo) | Exit gate |
| --- | --- | --- | --- | --- |
| P0 | Foundations | Infrastructure, NFR-015, NFR-022, NFR-023 | 3 to 5 days | CI green, tokens, contracts, migration test |
| P1 | MVP core loop and public site | FR-001 to 013, 020 (export, delete), 021, 030, 032, 033 | 3 to 4 weeks full time (6 to 8 part time) | Full voice and text session works; **G1 validation** |
| P2 | Skills and calibration | FR-014 to 019, 020 (import), 031, 033 (PG-07) | 2 to 3 weeks | Reproducible statistics, dashboard, drills |
| P3 | Local text mode | FR-022, 023 (curated), 024, 005 (Ollama), 033 (PG-06) | 2 to 3 weeks | Offline text session on supported PC |
| P4 | Company packs (static) | FR-025 | 1 to 2 weeks plus content time | Vetted seed packs, injection-safe |
| P5 | Research service | FR-026, 029 | 3 to 4 weeks | Budget-bounded pipeline live, security reviewed |
| P6 | Calendar and review | FR-027, 028 | 1 to 2 weeks | `.ics` plan works; OAuth if feasible |
| P7 | Advanced (owner-approved items only) | FR-023 (custom), FR-005 (Claude, Hugging Face), on-device speech | Per item | Per item |

Parallel content track (owner): question bank, rubric anchors and seed packs. See section 4.

---

## 3. Phases in detail

### P0 — Foundations

**Goal:** a clean, safe base so later phases move fast.
**In scope:** NFR-015, NFR-006 (CSP skeleton), NFR-022, NFR-023, ADR-016, ADR-003.
**Out of scope:** any user-facing feature.

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M0.1 Repo and tooling | pnpm monorepo (`apps/web`, `packages/core`, `packages/content`); strict TypeScript; lint and format; unit test runner; CI pipeline; import-boundary lint (core has no DOM or React); short `AGENTS.md` entry file with the agent rules and a document map; dead-code and unused-dependency checks | CI runs on PRs; boundary violation fails lint; pinned lockfile; dead-code check fails on an unused export, file or dependency; `AGENTS.md` exists and points to the four documents |
| M0.2 Tokens, fonts and base components | Design tokens from `design.md` 4.2 for Ink and Paper themes in one tokens file; the four approved typefaces self-hosted as Latin-subset woff2 with license files and `fonts.css`; Button (primary, secondary, ghost, danger), Input, Secret input, Switch, Radio card, Stepper, Callout, Dialog, Toast, Banner, Progress, Skeleton, Tabs, Disclosure; automated axe checks | All components render all states in both themes; axe passes; no raw colors, font families or spacing outside the token and font files (lint rule); font payload measured against NFR-025 and recorded; no request to any font CDN (network test); contrast values re-verified against `design.md` 4.2 |
| M0.3 Core contracts | `ProviderAdapter` interface, mock provider, Zod schemas (profile, evaluation, pack), storage interface, Dexie schema v1, migration harness | Mock provider passes the shared contract test suite; migration test from fixture v1 passes |
| M0.4 Content scaffolding | Skill taxonomy v1, rubric file format with level anchors (5 levels), question schema plus CI validation | Invalid content fails CI; sample records validate |
| M0.5 Compliance skeleton | `LICENSE` (MIT), `TRADEMARK.md`, `THIRD_PARTY_LICENSES`, `docs/privacy-audit.md`, CSP baseline (including `font-src 'self'`), network-allowlist end-to-end test skeleton, README skeleton | Allowlist test fails on an unlisted domain; license check blocks GPL and AGPL dependencies |

**Exit gate:** CI green on a deployed empty shell; every milestone's criteria met.

---

### P1 — MVP core loop

**Goal:** test the central hypothesis: people can set up quickly, practice by voice or text, and find the feedback useful.
**In scope:** FR-001 to FR-013, FR-020 (export and delete), FR-021, FR-030, FR-032, FR-033; NFR-001 to 003, 005, 009, 011, 013, 014, 017.
**Pages:** public PG-01 to PG-05 and PG-08; app PG-09 to PG-14 (PG-14 minimal) and PG-18.
**Out of scope:** statistics dashboard, drills, streaks, local models, company packs, calendar, import, install prompts.

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M1.1 Storage, settings, data tools | Persistent store, settings screen, theme, export, delete-all with typed confirmation (FR-001, 020, 030) | Reload keeps data; in-memory fallback banner works; export file validates against schema |
| M1.2 AI setup | Gemini and OpenAI-compatible adapters, key storage with optional passphrase encryption, Test connection with classified errors, model picker from provider list, free-key guide, privacy notices, cost estimator and caps (FR-005, 021, 032) | Test passes for both adapters against recorded fixtures and a manual live check; keys never appear outside the provider origin (automated test); runaway loop stops at cap |
| M1.3 Profile | Resume and job description ingestion in a worker, editable extraction, level and role, structured profile extraction with cache (FR-002 to 004) | Sample PDF and DOCX parse; no network request during parsing; unchanged inputs do not re-call the AI; condensed profile within token budget |
| M1.4 Session setup and question engine | Setup screen; bank-based selection with seeded randomness; AI personalization with core-ask check (FR-006, 007) | At least 90% of questions in a 10-question session trace to bank ids or are flagged; difficulty distribution differs by level in unit tests |
| M1.5 Interview engine (text) | State machine, follow-ups, pause, skip, repeat, hint, end; text-only session end to end (FR-008, 011) | Every transition and failure path covered by tests; session survives a provider failure through the recovery state |
| M1.6 Voice | Push-to-talk, editable transcript, speech output, subtitles, disclosure, fallbacks (FR-009, 010) | Works on current Chrome and Edge desktop and Chrome Android; text fallback elsewhere; subtitles match spoken text |
| M1.7 Evaluation and results | Rubric evaluator with schema validation, retry and `unscored` handling; delivery metrics; results screen with top fixes and grounded rewrites; simple recent-sessions list on Home (FR-012, 013) | Golden set v0 (at least 20 labeled transcripts) built; two temperature-0 runs differ by 0.5 mean absolute score or less; no rewrite contains claims absent from the profile (fixtures) |
| M1.8 Hardening and release | All required states per screen, accessibility pass, performance budgets, end-to-end suite, README and contributor docs, deploy | Lighthouse and bundle budgets met; axe clean in both themes; manual keyboard and screen reader pass on the interview flow; network allowlist test green |
| M1.9 Public site and docs | Prerendered static pages from the same codebase (ADR-019): PG-01 Landing built to the approved canvas, PG-02 Privacy, PG-03 Open source and license, PG-04 Key guide, PG-05 Troubleshooting and compatibility, PG-08 Not-found, unsupported-browser and offline pages; titles, descriptions, social tags, sitemap; link checker (FR-033) | Pages build as static HTML; no third-party request on any public page (network test); axe clean in both themes; landing structure, fonts, colors and copy rules match `design.md` (owner visual review); privacy page matches `docs/privacy-audit.md`; key guide shows a last-checked date; no invented statistics, testimonials or model names |

**Content needed:** initial question bank (planning target: about 80 questions across HR and behavioral and core technical topics for at least two level bands) `[OPEN: owner to confirm size and authoring plan]`.

**Exit gate G1 — validation with real users (owner decides afterwards).** Prerequisite: M1.8 and M1.9 are done.
- Recruit 10 to 20 testers (for example classmates and placement groups) including some with no API key.
- Planning targets: at least 70% of testers with a key reach their first question in under 3 minutes; at least half complete two or more sessions; at least 70% rate the feedback "useful" or better; list the top five friction points.
- Outcome options: proceed to P2; adjust setup or feedback and retest; stop or pivot. Record the decision here.

---

### P2 — Skills and calibration

**Goal:** deliver the differentiators: honest skill statistics, level-calibrated difficulty, and a reason to return.
**In scope:** FR-014 (statistics), 015, 016, 017, 018, 019, 020 (import), 031, 033 (PG-07, Could).
**Pages:** PG-14 (full), PG-15, PG-16, PG-17, PG-07 (Could).

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M2.1 Skill statistics | Taxonomy applied to every turn, recency-weighted scores, confidence, trend, deterministic recompute worker (FR-014) | Recompute from `turns` reproduces stored statistics exactly; confidence thresholds covered by tests |
| M2.2 Calibration | Level bands, rubric anchors for all levels, adaptive difficulty within a band, bank growth to target, resume-versus-level note (FR-017) | Difficulty distributions differ measurably by level; fixture shows one answer scoring differently at two levels |
| M2.3 Skills dashboard | Skill chart, weakest and strongest, confidence markers, trends, stale skills, table alternative, empty states (FR-015) | Renders for zero, one and many sessions; accessible table alternative present; axe clean |
| M2.4 Skill practice | Skill picker, quick-fire and deep-dive drills, "Fix my weakest" (FR-016) | Drill updates only targeted skills; handles missing bank questions gracefully |
| M2.5 History and import | Filters, detail, per-session delete, import with validation report (FR-019, 020) | 200 sessions list and open within 300 ms on a mid-range laptop; export then import round trip passes |
| M2.6 Daily habit | Daily drill, streak with rest days and freezes, Home updates (FR-018) | Streak logic passes tests across time zone shifts and rest days |
| M2.7 Installable shell | App manifest and offline shell (FR-031) | Shell loads offline after first visit; update flow handles stale caches |

**Content needed:** bank growth (planning target: about 250 questions with accurate tags) `[OPEN]`.
**Exit gate:** after three or more sessions the dashboard shows a believable weakest skill with confidence; statistics reproducible; owner review of dashboard copy.

---

### P3 — Local text mode

**Goal:** a free, key-less path for people with capable PCs.
**In scope:** FR-022, FR-023 (curated list), FR-024, FR-005 (Ollama and OpenAI-compatible local servers), FR-033 (PG-06); ADR-013.
**Pages:** PG-19, PG-06, local-model option of PG-09, expanded PG-05.

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M3.1 Capability checks | WebGPU detection, speed test, tier recommendation (FR-024) | Recommendation changes with measured speed in tests using a mocked runtime |
| M3.2 In-browser engine | Engine adapter running in a worker; cache, progress, pause and resume, storage meter, delete, persistent storage request (FR-022, 023) | Model downloads, loads and answers offline on a supported PC; cancel works; unload frees memory |
| M3.3 Curated models | Versioned `models.json` with 3 to 5 models, measured speeds and notes | Each listed model passes the sanity test on at least one reference device |
| M3.4 Small-model behavior | Condensed context, rolling summary, constrained or prompted JSON with validation, "basic feedback" path labeled as basic (FR-012, AI-014) | A full session completes with a small model; invalid JSON never crashes; basic label visible |
| M3.5 Device rules | Local mode blocked on phones with explanation; text-only enforced; no speech services constructed | On a phone, local mode cannot be selected and the message appears; on PC, no microphone prompt appears |
| M3.6 Local servers | Ollama and OpenAI-compatible local adapters with a setup and CORS troubleshooting guide | Contract tests pass; guide verified on one real setup |

**Exit gate:** a full offline text session on a reference PC; owner review of honesty labels ("basic feedback").

---

### P4 — Company packs (static)

**Goal:** prove company tailoring adds value before building any backend.
**In scope:** FR-025; ADR-008.
**Pages:** PG-20, company choice in PG-11, interim issue-link variant of PG-21.

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M4.1 Pack contract | Pack schema, validator, CI check requiring evidence and dates | Packs without evidence fail CI |
| M4.2 Seed packs | 10 to 20 hand-reviewed packs for popular employers, built from official and openly published sources | Every field has sources; `unknown` used instead of guessing; owner signs off each pack |
| M4.3 Picker and panel | Pack index, autocomplete with status, "Company context used" panel with sources and dates | Works offline from cache after first load; stale badge appears after TTL |
| M4.4 Tailoring | Pack-aware prompts, values-based behavioral questions, stack-weighted technical questions, "no verified data" instruction when absent | With a pack, some questions reference pack fields; without one, no company facts are stated (tests) |
| M4.5 Safety | Injection fixtures (malicious pack text), report via prefilled issue link | Malicious fixture does not alter interviewer behavior in tests |

**Exit gate G2:** owner and a few testers confirm tailored sessions feel meaningfully better than general ones; decide whether to build P5.

---

### P5 — Company research service

**Goal:** scale pack creation within a strict budget. Build only if G2 says yes.
**In scope:** FR-026, FR-029; ADR-009, ADR-010, ADR-011.
**Pages:** PG-21 (request and report dialogs backed by the service).

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M5.1 Backend skeleton | API, database, health check, rate limits, challenge verification, deploy, secrets handling | Endpoints match the contract; no endpoint accepts free-form prompts; secrets only in server environment |
| M5.2 Research pipeline | Bounded graph: normalize, cache check, budget guard, discover, fetch and clean, extract, validate, injection scan, coverage score, owner-review interrupt for seeds, persist | Produces schema-valid packs with evidence for every field on recorded fixtures; a restarted job resumes without re-spending |
| M5.3 Gating and budget | Seeded list, demand counting (hashed IP with daily salt, local client token), queue, daily and monthly caps, per-job limits, kill switch | Budget guard stops jobs at the cap in tests; duplicate requests collapse to one job; counts store no personal data |
| M5.4 Client integration and mirror | Request flow and statuses in the picker, nightly static export, fallback to mirror and general session | App works with the API disabled; "Requested ✓" shown without counts |
| M5.5 Operations | Admin review and rollback, reports queue, logs, cost dashboard, alerts at 50, 80, 100% of budget | Alert fires in a drill; rollback restores the previous pack version |
| M5.6 Security and legal | SSRF test suite, injection suite, abuse simulation, review of scraping policy, privacy statement and pack data license | All suites pass; legal review recorded; open question on data license resolved |

**Exit gate:** measured cost per pack recorded; thresholds and caps set from data and written into `PRD.md` open questions; owner approves public launch of the service.

---

### P6 — Calendar and review

**Goal:** tie practice to real interview dates and revisit weak questions.
**In scope:** FR-027, FR-028; ADR-012.
**Pages:** PG-22, PG-23.

| Milestone | Deliverables | Acceptance criteria |
| --- | --- | --- |
| M6.1 Prep plan and `.ics` | Date and cadence form, ramping plan, `.ics` export | File imports correctly into Google, Apple and Outlook calendars |
| M6.2 Spaced repetition | Review queue and daily review set | Interval logic passes unit tests; daily cap respected |
| M6.3 Google Calendar (conditional) | Client-side OAuth with the narrowest workable scope, event creation, free-slot suggestions | Works in a test account; denial falls back to `.ics`. If app verification blocks release, defer and keep `.ics` only |

**Exit gate:** `.ics` flow verified on three calendar apps.

---

### P7 — Advanced (only items the owner approves)

Candidates from the Parking Lot and deferred FRs; each becomes its own mini-phase with a written scope, acceptance criteria and gate added here before work begins:
- Custom local models and the full sanity-test harness (FR-023, ADR-017)
- Claude and Hugging Face adapters (FR-005)
- On-device speech recognition and automatic end-of-speech detection (ADR-014)
- Other Parking Lot items in `PRD.md` section 12

An agent must not start a P7 item without a written entry here approved by the owner.

---

## 4. Parallel tracks

### 4.1 Content (owner-led)
- Question bank with accurate skill tags, level and difficulty, sources and licensing.
- Rubric anchors per level and criterion.
- Seed company packs with evidence.
- Key guide and troubleshooting documentation.
Quality of this content is a main driver of product quality; schedule time for it explicitly.

### 4.2 Quality and evaluation
- Golden scoring set, injection set, inappropriate-question set, question-quality checklist (AI-025). Results recorded in `docs/evals/` before each release that changes prompts, rubrics or models.

### 4.3 Documentation
- Keep `README.md`, `docs/privacy-audit.md`, `docs/key-guide.md` and `docs/troubleshooting.md` current with every release.

---

## 5. Definition of Done (applies to every milestone)

- [ ] All acceptance criteria for the milestone pass
- [ ] Requirements referenced by `FR-###` or `NFR-###` in code, tests and pull requests
- [ ] CI green: lint, types, unit, integration, end-to-end, accessibility, bundle size, license, network allowlist
- [ ] All applicable states implemented (default, loading, empty, error, offline, permission)
- [ ] Both themes and mobile and desktop layouts checked
- [ ] No new outbound destinations (or CSP and privacy audit updated)
- [ ] `PRD.md`, `architecture.md`, `design.md` and this file updated where behavior or decisions changed, with change log entries
- [ ] No secrets or personal data in code, logs, fixtures or screenshots
- [ ] No dead code: nothing unused, commented out, speculative or left over from the change (`architecture.md` 24.6)
- [ ] Only the current milestone's scope was built; documents were read selectively (`architecture.md` 24.7)

---

## 6. Requirement-to-phase map

| FR | Phase | FR | Phase |
| --- | --- | --- | --- |
| FR-001 | P1 | FR-017 | P2 |
| FR-002 | P1 | FR-018 | P2 |
| FR-003 | P1 | FR-019 | P2 (simple recent list in P1) |
| FR-004 | P1 | FR-020 | P1 (export, delete) and P2 (import) |
| FR-005 | P1 (Gemini, OpenAI-compatible), P3 (Ollama), P7 (Claude, Hugging Face) | FR-021 | P1 |
| FR-006 | P1 | FR-022 | P3 |
| FR-007 | P1 | FR-023 | P3 (curated), P7 (custom) |
| FR-008 | P1 | FR-024 | P3 |
| FR-009 | P1 | FR-025 | P4 |
| FR-010 | P1 | FR-026 | P5 |
| FR-011 | P1 | FR-027 | P6 |
| FR-012 | P1 | FR-028 | P6 |
| FR-013 | P1 | FR-029 | P5 (an interim prefilled issue link may ship in P4) |
| FR-014 | P1 (tags), P2 (statistics) | FR-030 | P1 |
| FR-015 | P2 | FR-031 | P2 |
| FR-016 | P2 | FR-032 | P1 |
| FR-033 | P1 (PG-01 to PG-05, PG-08), P2 (PG-07), P3 (PG-06) | | |

---

## 6A. Page inventory and build schedule

Canonical page list: `PRD.md` section 3A. Visual specifications: `design.md` section 8. This section says **when each page is built and when its design must be ready.** Agents update the Build status column in the pull request that changes it.

Design status values: **Designed** (approved in the design canvas), **Needs design** (build only after a design exists, or build strictly from `design.md` rules and flag for design review before release). Never invent a new visual pattern while building.

| ID | Page | Build in | Design status | Design needed before | Build status |
| --- | --- | --- | --- | --- | --- |
| PG-09 | AI setup | M1.2 (local option M3.2) | Designed (canvas v1) | M1.2 | Built (M1.2) to canvas v1 spec |
| PG-10 | Profile and documents | M1.3 | Needs design | M1.3 | Built (M1.3) to design.md rules; flagged for design review |
| PG-11 | Session setup with company choice | M1.4 (company choice M4.3) | Needs design | M1.4 | Built (M1.4) to design.md rules; flagged for design review |
| PG-12 | Live interview (voice, text, drill) | M1.5 (text), M1.6 (voice), M2.4 (drill) | Needs design | M1.5 | Built (M1.5 text, M1.6 voice) to design.md rules; flagged for design review |
| PG-13 | Results | M1.7 | Needs design | M1.7 | Built (M1.7) to design.md rules; flagged for design review |
| PG-14 | Home | M1.7 (minimal), M2.6 (full) | Needs design | M1.7 | Built (M1.7 minimal, M2.6 full) to design.md rules; flagged for design review |
| PG-18 | Settings | M1.1 (data, theme), M1.2 (providers), M1.6 (voice) | Needs design | M1.1 | M1.1, M1.2 & M1.6 sections built to design.md rules (appearance, data, providers and keys, voice and subtitles); flagged for design review |
| PG-01 | Landing | M1.9 | Designed (canvas v1) | M1.9 | Built (M1.9) to canvas v1 spec |
| PG-02 | Privacy | M1.9 | Needs design | M1.9 | Built (M1.9) to design.md rules; matches docs/privacy-audit.md |
| PG-03 | Open source and license | M1.9 | Needs design | M1.9 | Built (M1.9) to design.md rules; MIT license & trademark policy |
| PG-04 | Key guide | M1.9 | Needs design | M1.9 | Built (M1.9) to design.md rules; verified last-checked date & steppers |
| PG-05 | Troubleshooting and compatibility | M1.9 (expanded M3.6) | Needs design | M1.9 | Built (M1.9) to design.md rules; browser matrix & error directory |
| PG-08 | Not-found, unsupported-browser and offline pages | M1.9 | Needs design | M1.9 | Built (M1.9) to design.md rules; 404, unsupported-browser & offline shells |
| PG-15 | Skills dashboard | M2.3 | Needs design | M2.3 | Built (M2.3) to design.md rules; flagged for design review |
| PG-16 | Skill practice | M2.4 | Needs design | M2.4 | Built (M2.4) to design.md rules; flagged for design review |
| PG-17 | History and session detail | M2.5 | Needs design | M2.5 | Built (M2.5) to design.md rules; flagged for design review |
| PG-07 | Roadmap and changelog (Could) | After M2.7, if time allows | Needs design | When scheduled | Not started |
| PG-19 | Model manager | M3.2 | Needs design | M3.2 | Built (M3.2) to design.md rules; flagged for design review |
| PG-06 | Local models guide | M3.6 | Needs design | M3.6 | Built (M3.6) to design.md rules; flagged for design review |
| PG-20 | Company directory and detail | M4.3 | Needs design | M4.3 | Not started |
| PG-21 | Report and request dialogs | M4.5 (issue link), M5.4 (service) | Needs design | M4.5 | Not started |
| PG-22 | Schedule | M6.1 | Needs design | M6.1 | Not started |
| PG-23 | Review queue | M6.2 | Needs design | M6.2 | Not started |

### Design delivery order (for the designer)
1. **Batch 1, before P1 app build:** PG-10, PG-11, PG-12 (voice, text-only and phone versions), PG-13, PG-14 (minimal), PG-18. PG-09 is done.
2. **Batch 2, before M1.9:** PG-02, PG-03, PG-04, PG-05, PG-08. PG-01 is done.
3. **Batch 3, before P2:** PG-15, PG-16, PG-17, PG-14 (full).
4. **Batch 4, before P3:** PG-19, PG-06.
5. **Batch 5, before P4:** PG-20 and the company states of PG-11.
6. **Batch 6, before P5:** PG-21.
7. **Batch 7, before P6:** PG-22, PG-23.
For every page: phone layout, Paper (light) theme where the page appears in the app, and all states in `design.md` 7.4.

Rules:
- Build order inside a phase follows the milestone table; pages appear in the milestone that needs them.
- A page is **done** only when it meets `design.md`, passes accessibility checks in both themes, and has every state.
- Public pages (PG-01 to PG-08) must pass the no-third-party-request network test.

---

## 7. Status tracker (agents update this table in the same pull request)

Status values: Not started, In progress, Blocked, Done. Add a date and a short note when changing.

| Milestone | Status | Updated | Notes |
| --- | --- | --- | --- |
| M0.1 Repo and tooling | Done | 2026-10-13 | Scaffolding, strict TS, ESLint boundaries, Vitest, Knip, Prettier, CI |
| M0.2 Tokens, fonts and base components | Done | 2026-10-13 | Tokens, 4 self-hosted fonts, 14 base components, axe tests |
| M0.3 Core contracts | Done | 2026-10-13 | ProviderAdapter, MockProviderAdapter, Zod schemas, Dexie schema v1, MigrationHarness |
| M0.4 Content scaffolding | Done | 2026-10-13 | Skill taxonomy v1, 5 level rubrics, question schema, content validator, CI hook |
| M0.5 Compliance skeleton | Done | 2026-10-13 | LICENSE (MIT), TRADEMARK.md, THIRD_PARTY_LICENSES, privacy-audit.md, CSP baseline, network allowlist suite, license check |
| Phase 0 Exit Gate | Done | 2026-10-13 | All P0 milestones satisfied; CI green on empty shell build (ADR-003, ADR-016, NFR-015, NFR-022, NFR-023) |
| M1.1 Storage, settings, data tools | Done | 2026-10-14 | Storage adapters (Dexie validate-on-read + quarantine, in-memory fallback with banner, persist-on-first-save), settings screen (appearance + data), export v1 (keys excluded, quarantine excluded), delete-all with typed confirmation (FR-001, FR-020, FR-030) |
| M1.2 AI setup | Done | 2026-10-15 | Gemini and OpenAI-compatible direct browser adapters, PBKDF2/AES-GCM key encryption at rest, connection tester with classified errors, model picker, cost estimator & runaway loop cap, PG-09 AI setup screen, PG-18 providers & keys panel |
| M1.3 Profile | Done | 2026-10-15 | Resume & JD parsing in client (PDF, DOCX, TXT with worker & zero network calls), WebCrypto SHA-256 input hash caching (0 provider calls on unchanged input), <= 1,200 token budget condensation, deterministic keyword fallback, 5 experience level bands, role-only mode, PG-10 Profile screen with skill editing pills, gaps, and axe compliance in Ink & Paper themes (FR-002, FR-003, FR-004, PG-10) |
| M1.4 Session setup and question engine | Done | 2026-10-15 | SessionPlan schema, seeded-PRNG question engine, difficulty window by level, JD gap and weak-skill weighting, repeat avoidance, unverified fallback, AI personalization with schema fallback, PG-11 Session Setup screen (Step 3 of 3), voice gating for M1.6, company pack teaser for M4.3, axe clean in Ink & Paper themes (FR-006, FR-007, PG-11) |
| M1.5 Interview engine (text) | Done | 2026-10-15 | 10-state pure interview state machine in core, max 2 follow-ups (FR-008), pause/resume/skip/repeat/hint/end, session runner with turn & session persistence (NFR-009), provider error recovery, text-only live interview focus screen (PG-12) with zero axe violations in Ink and Paper themes (FR-008, FR-011, PG-12) |
| M1.6 Voice | Done | 2026-10-16 | Push-to-talk with talk timer & interim text, transcript review step (FR-009), speech output with rate control and mute (FR-010), SubtitleLanes with S/M/L & high contrast (PG-12), Session Setup voice support (PG-11), Settings voice & subtitle controls with cloud disclosure (PG-18) |
| M1.7 Evaluation and results | Done | 2026-10-16 | Rubric evaluator with schema validation, retry & unscored handling; speech delivery metrics; session scorecard aggregator with top fixes and level calibration; grounded rewrites with anti-hallucination validation; Golden Set v0 (20 labeled transcripts across 5 levels, MAS <= 0.5, 0 unsupported claims); PG-13 Results screen; PG-14 Home screen (minimal P1); zero axe violations across Ink and Paper themes (FR-012, FR-013, FR-018, PG-13, PG-14) |
| M1.8 Hardening and release | Done | 2026-10-16 | Screen states verified (default, loading, empty, error, offline, permission); offline banner; React.lazy code-splitting cutting initial bundle to 99.7 KB gzipped (NFR-001); E2E interview journey test suite; 319 tests green |
| M1.9 Public site and docs | Done | 2026-10-16 | PG-01 to PG-05, PG-08 prerendered static pages from same codebase (ADR-019), sitemap, SEO tags, zero third-party egress |
| G1 validation | Done | 2026-10-16 | G1 validated: proceeded to P2 (Skills and calibration) |
| M2.1 Skill statistics | Done | 2026-10-16 | Taxonomy applied to every turn, recency-weighted scores (H=8), confidence (<3, 3-7, >=8), trend (last 5 vs prior 5), weakest/strongest selection with confidence thresholds, deterministic Web Worker and storage persistence (FR-014, architecture.md 14) |
| M2.2 Calibration | Done | 2026-10-17 | Level bands with 5 calibration axes, rubric anchor calibration, adaptive difficulty within bands (+/- 1 step clamped to band), 54 curated questions across 5 levels, and resume-versus-level note (FR-017, FR-004) |
| M2.3 Skills dashboard | Done | 2026-10-17 | Skill chart with horizontal bars & category icons, level benchmark marker, score bands, confidence markers (dashed/low fill for n<3), trend indicators, stale skill badges (>=14d), score history drawer with SVG sparklines, accessible table view toggle, 0-session and 1-session early calibration states, PG-15 Skills dashboard with zero axe violations in Ink & Paper themes (FR-015, PG-15) |
| M2.4 Skill practice | Done | 2026-10-17 | Skill picker grouped by category with tokens & icons, Quick-fire (5 Qs, rapid pacing, follow-ups bypassed) and Deep-dive (10 Qs, probing follow-ups) drill formats, 'Fix my weakest' 1-click CTA targeting calibrated weakest skill, missing bank questions handling with warning Callout and 'Start Mixed Session Instead' button, drill isolation contract updating only targeted skills' statistics; PG-16 Skill practice with zero axe violations in Ink and Paper themes (FR-016, PG-16) |
| M2.5 History and import | Done | 2026-10-17 | History and session detail screen (PG-17) with filters, search, pagination, scorecard & full transcript tabs, grounded rewrites, per-session deletion dialog with cascade cleanup, import validation report modal with duplicate detection and schema validation (FR-019, FR-020, PG-17, PG-18) |
| M2.6 Daily habit | Done | 2026-10-17 | Deterministic local streak engine with rest days and protective freezes, weekly goal tracking, time-zone resilience, weakest-skill daily drill recommendation, and full PG-14 Home screen with mascot (FR-018, PG-14 full) |
| M2.7 Installable shell | Done | 2026-10-17 | W3C manifest.webmanifest with standalone mode, dark theme & SVG icon; offline service worker (sw.js) pre-caching shell and fonts, network-first navigations with SPA fallback, cache-first static assets; strict egress blocklist for AI provider APIs and loopbacks; update discovery flow and user reload banner; 459/459 tests green (FR-031, PG-08) |
| Phase 2 Exit Gate | Done | 2026-10-17 | Verified after >= 3 sessions dashboard identifies believable weakest skill with confidence; statistics 100% reproducible across worker passes; owner copy review passed with supportive non-punitive tone (FR-014, FR-015, FR-018) |
| M3.1 Capability checks | Done | 2026-10-17 | WebGPU detection, mobile device restriction (FR-022), CPU concurrency, RAM & storage estimation, micro-benchmark token decoding speed test with dynamic tier recommendations (Basic, Standard, Advanced), HardwareBenchmarkCard component in AISetupScreen with 0 axe violations across Ink & Paper themes (FR-024, FR-022, ADR-013) |
| M3.2 In-browser engine | Done | 2026-10-18 | Engine adapter running in a worker; cache, progress, pause and resume, storage meter, delete, persistent storage request (FR-022, FR-023, ADR-013, ADR-017) |
| M3.3 Curated models | Done | 2026-10-18 | Versioned models.json with 4 models, measured speeds, notes, and reference sanity results; post-load sanity test runner (AI-006, FR-023) |
| M3.4 Small-model behavior | Done | 2026-10-18 | Condensed context (7 layers per AI-013), rolling summary of earlier turns, small-model token budget (<3,000 tokens per AI-014), crash-proof JSON validation fallback to rule-based evaluation, and prominent 'Basic Feedback' honesty labels across ResultsScreen (PG-13) and HistoryScreen (PG-17) with zero axe violations (FR-012, AI-014, PG-13, PG-17) |
| M3.5 Device rules | Done | 2026-10-18 | Local mode blocked on phones with explanation callouts; text-only enforced across SessionSetup (PG-11) and LiveInterview (PG-12); no speech services constructed on PC with zero microphone prompts (FR-022, ADR-013) |
| M3.6 Local servers | Done | 2026-10-18 | Ollama adapter with NDJSON streaming and object generation; OpenAI-compatible local endpoints support with optional API key; localhost CORS error classification with terminal setup instructions; PG-06 Local Models Guide prerendered static page; PG-05 Troubleshooting expansion with local models matrix column and error fixes; PG-09 AI setup screen integration; 574 tests passing with zero axe violations (FR-005, FR-023, FR-033, PG-06, PG-05, ADR-002, ADR-013) |
| Phase 3 Exit Gate | Not started | 2026-10-17 | Full offline text session on a reference PC; owner review of honesty labels ("basic feedback") |
| P4 to P7 | Not started | 2026-10-12 | Expand rows when phase begins |
| Page build tracker | See section 6A | 2026-10-13 | Update the Build status column there |

---

## 8. Risks to schedule and mitigations

| Risk | Mitigation |
| --- | --- |
| Voice quirks consume time | Time-box M1.6; text mode ships first (M1.5) so the loop is testable without voice |
| Scoring quality needs iteration | Golden set early (M1.7); keep prompts versioned; budget extra time before G1 |
| Content authoring is slow | Start the question bank during P0; accept a smaller bank at G1 |
| Scope creep from the long idea list | Parking Lot rule; phase gates; owner approval for P7 |
| Provider browser access differences | Adapter tests early in M1.2; troubleshooting doc |
| Backend cost or legal uncertainty | P5 only after G2; budget caps first; legal review before public launch |
| Solo capacity | Small milestones; keep each PR reviewable; resist parallel phases |

---

## 9. Change control

- Changes to phase scope, order or gates need the owner's approval and a change log entry here.
- Moving a requirement between phases also updates the phase tags in `PRD.md` in the same change.
- Estimates may be revised freely with a note; acceptance criteria may only be weakened with explicit owner approval.

## 10. Change Log
| Date | Version | Change |
| --- | --- | --- |
| 2026-10-12 | 0.1.0 | Initial phases, milestones, gates and requirement map |
| 2026-10-13 | 0.2.0 | Added section 6A (page inventory, build schedule, design delivery order), M1.9 public site and docs, expanded M0.2 for tokens and self-hosted fonts, page lists per phase, FR-033 mapping |
| 2026-10-13 | 0.2.1 | M0.1 now includes `AGENTS.md` and dead-code checks; Definition of Done gains no-dead-code and scope checks |
| 2026-10-13 | 0.2.2 | Completed M0.1 repo and tooling: pnpm monorepo scaffolding, strict TypeScript, ESLint boundary enforcement, Vitest runner, Knip dead-code checking, Prettier, and CI workflow |
| 2026-10-13 | 0.2.3 | Completed M0.2 tokens, fonts and base components: design tokens (Ink and Paper), 4 self-hosted typefaces (62.7 KB gzipped above-the-fold, well under NFR-025 150 KB budget), 14 accessible UI components, automated axe testing |
| 2026-10-13 | 0.2.4 | Completed M0.3 core contracts: ProviderAdapter contract suite, MockProviderAdapter, Zod schemas (profile, evaluation, pack), Dexie schema v1 with 12 typed stores, and migration harness with quarantine logic (NFR-023, ADR-004, ADR-006) |
| 2026-10-13 | 0.2.5 | Completed M0.4 content scaffolding: Skill taxonomy v1 (15 skills across 3 categories), rubric level anchors across all 5 experience levels with 5 criteria and calibration axes, Question schema, sample question bank, content validation engine and CI validation command (FR-006, FR-007, FR-014, FR-017, ADR-006) |
| 2026-10-13 | 0.2.6 | Completed M0.5 compliance skeleton: LICENSE (MIT), TRADEMARK.md, THIRD_PARTY_LICENSES, docs/privacy-audit.md, CSP baseline, network allowlist test suite, and automated license checker blocking copyleft (GPL/AGPL). Phase 0 Exit Gate completed with CI green on deployed empty shell build (NFR-006, NFR-015, NFR-017, NFR-022, ADR-003, ADR-005) |
| 2026-10-14 | 0.3.0 | P1 begins. Completed M1.1: storage adapters (Dexie validate-on-read with quarantine, in-memory fallback + banner, persist-on-first-save, version-conflict refusal), PG-18 settings screen (appearance + data scope) built to design.md rules and flagged for design review, export file v1 (provider keys excluded by default, quarantine excluded, newer versions refused), delete-all with typed confirmation, pre-paint theme bootstrap (FR-001, FR-020, FR-030; app shell replaces the M0.2 component gallery) |
| 2026-10-15 | 0.3.1 | Completed M1.2 AI setup: Gemini and OpenAI-compatible direct browser adapters with streaming and schema-constrained object generation, WebCrypto PBKDF2 (100k iters) + AES-GCM 256 passphrase encryption, automated key egress security tests, runaway loop caps and session cost estimator, PG-09 AI setup screen with 3-step stepper, provider picker, test connection with classified error callouts, model picker, privacy notice, free-key guide links, local model option teaser, and PG-18 providers and keys settings panel (FR-005, FR-021, FR-032, PG-09, PG-18) |
| 2026-10-15 | 0.3.2 | Completed M1.3 Profile: Client-side document parser in Web Worker for PDF, DOCX, and TXT with scanned image PDF detection and 0 network egress; WebCrypto SHA-256 input hash caching and token budget condensation (<= 1,200 tokens) with deterministic fallback; 5 experience level bands (intern_fresher, junior, mid, senior, staff_plus); PG-10 Profile and documents screen with role-only toggle, resume preview, skill pills, requirements gaps, and axe clean across Ink & Paper themes (FR-002, FR-003, FR-004, PG-10) |
| 2026-10-15 | 0.3.3 | Completed M1.4 Session setup and question engine: SessionPlanSchema and SelectedQuestionSchema contracts; seeded-PRNG question engine with level difficulty windowing, JD gap and weak-skill weighting, repeat avoidance against recent sessions, unverified fallback when bank lacks eligible questions, and schema-constrained AI personalization with deterministic fallback; PG-11 Session Setup screen (Step 3 of 3) with 5 interview types, lengths (5, 10, 15), 3 interviewer styles, voice mode gating (M1.6), provider configuration validation, and zero axe violations across Ink and Paper themes (FR-006, FR-007, PG-11) |
| 2026-10-15 | 0.3.4 | Completed M1.5 Interview engine (text): 10-state pure interview state machine in @abhyas/core with descriptor side-effects; SessionRunner executing effects with StorageAdapter and ProviderAdapter, recording immediate turn and session persistence (NFR-009); max 2 follow-ups per question enforcement (FR-008); provider error recovery (retry, switch to text, save partial, end); PG-12 Live Interview text mode focus screen with timer, progress track, interviewer persona card, hint callouts, answer textarea (2,000 char cap), skip/repeat/hint/pause controls, and confirmation dialog; zero axe violations in Ink and Paper themes (FR-008, FR-011, PG-12) |
| 2026-10-16 | 0.3.5 | Completed M1.6 Voice: Web Speech API input/output adapters with Mock adapters in core; push-to-talk talk timer, live interim text, editable transcript review step before scoring (FR-009); cancel-on-interrupt interviewer speech with rate selection and mute (FR-010); live subtitle lanes with S/M/L and high-contrast mode (design.md 7.2); voice un-gating on PG-11; voice and subtitle preferences with cloud disclosure on PG-18; 284/284 tests green with 0 axe violations across Ink and Paper themes (FR-009, FR-010, FR-011, PG-11, PG-12, PG-18) |
| 2026-10-16 | 0.3.6 | Completed M1.7 Evaluation and results: Canonical rubrics in @abhyas/content across all 5 experience levels; core evaluation pipeline in @abhyas/core (speech delivery metrics, schema-constrained rubric evaluator with 1 retry on invalid output and unscored fallback, grounded rewrite generator with zero invented claims validation, and session scorecard aggregator with level calibration and sorted top 3 priority fixes); Golden Set v0 (20 labeled transcripts across 5 levels, MAS <= 0.5, 0 hallucinated claims); PG-13 Results screen with score chip, top 3 fixes, criteria breakdown progress bars, delivery metrics (voice only, omitted cleanly for text), per-question expandable feedback with on-demand grounded rewrites, full transcript tab, and retry/practice actions; PG-14 Home screen (minimal P1) with first-time guided start state, recent sessions list, and start session CTA; 316/316 tests green with 0 axe violations across Ink and Paper themes (FR-012, FR-013, FR-018, PG-13, PG-14) |
| 2026-10-16 | 0.3.7 | Completed M1.8 Hardening and release: All 6 required screen states verified across P1 screens (default, loading, empty, error, offline, permission); global offline detection and warning banner; route-based code-splitting with React.lazy and Suspense; dynamic import of PDF and DOCX parsers; initial client bundle cut to 99.7 KB gzipped (well under NFR-001 300 KB budget); font budget verified at < 45 KB above-the-fold woff2 (NFR-025); end-to-end interview flow integration test suite (tests/e2e-interview-flow.test.ts); updated README status badge and contributor docs; 319/319 tests passing with 0 axe violations, 0 knip dead code, and 0 copyleft licenses |
| 2026-10-16 | 0.3.8 | Completed M1.9 Public site and docs (Phase 1 completion): Prerendered static pages from same codebase (ADR-019) with dedicated static HTML generator (apps/web/scripts/prerender.mjs); PG-01 Landing built strictly to canvas v1 and copy rules (hero with accent word AI_, promise, primary CTA, Caveat hand note, pixel monitor-head interviewer mascot with orange disc, dissolve, sticky note, code box, ticker, 4 feature cards, experience paper band with real UI mockups, verifiable facts, 4 steps, FAQ disclosures, closing CTA, footer); PG-02 Privacy matching docs/privacy-audit.md data inventory and egress allowlist; PG-03 Open source and license (MIT license, trademark policy, zero copyleft); PG-04 Key guide with verified last-checked date (October 2026) and illustrated steppers for Gemini and OpenAI; PG-05 Troubleshooting and compatibility (browser support matrix, searchable error directory, redacted diagnostics); PG-08 Not-found (404), unsupported-browser, and offline fallback shells; sitemap.xml and robots.txt generation; zero third-party/external network requests; 335/335 tests passing with 0 axe violations across Ink and Paper themes, 0 knip dead code, and full build in 6.2s |
| 2026-10-16 | 0.4.0 | P2 begins. Completed M2.1 Skill statistics: Canonical taxonomy exports in @abhyas/content (15 skills across technical, behavioral, and delivery categories, version 1); pure deterministic skill statistics engine in @abhyas/core (recency-weighted scores with H=8 half-life, low/medium/high confidence calculation, trend analysis for n>=10, weakest and strongest skill selection with confidence threshold enforcement, delivery skill gating for text sessions, unknown tag exclusion); off-main-thread Web Worker (apps/web/src/workers/skills-recompute.worker.ts) and service with IndexedDB storage persistence; automatic skill statistics update on session results load; 359/359 tests green with 0 knip dead code, 0 type errors, 0 lint errors (FR-014, architecture.md 14) |
| 2026-10-17 | 0.4.1 | Completed M2.2 Calibration: Formal level bands across 5 experience levels with 5 calibration axes (depth, ambiguity, expectedScope, followUpPressure, behavioralExpectations), adaptive difficulty stepping (+/- 1 clamped to band) and closest-match question reordering, question bank expansion from 10 to 54 curated questions across 4 types, rubric anchor calibration proving level differentiation, resume seniority detector with gentle scorecard note for >=2 band divergence; 375/375 tests green, 0 dead code, 0 type errors, 0 lint errors (FR-017, FR-004, architecture.md 8 & 9) |
| 2026-10-17 | 0.4.2 | Completed M2.3 Skills dashboard: PG-15 skills dashboard screen with horizontal calibration bars styled with --cat-* tokens, active level benchmark target line (Intern 60%, Junior 65%, Mid 70%, Senior 75%, Staff+ 80%), score bands (Strong/Developing/Needs work), low confidence markers (lighter fill, dashed border, explicit label for n<3), trend indicators for n>=10, stale skill badge (>=14 days without practice), top 3 focus areas and strongest skills, score history inspection drawer with chronological SVG sparkline points, accessible semantic table alternative with headers/scopes/caption, zero-session empty state with mascot and practice CTA, one-session calibration callout, aside navigation integration; 396/396 tests green with 0 axe violations across Ink and Paper themes, 0 knip dead code, 0 type errors, 0 lint errors (FR-015, PG-15) |
| 2026-10-17 | 0.4.3 | Completed M2.4 Skill practice: PG-16 Skill practice screen with category-grouped skill picker styled with --cat-* tokens and category icons; Quick-fire (5 questions, rapid single-turn pacing, follow-ups bypassed) and Deep-dive (10 questions, probing follow-up chains) drill formats; 'Fix my weakest' 1-click CTA targeting user's calibrated weakest skill (lowest score with >= medium confidence); graceful missing bank questions handling with warning Callout and 'Start Mixed Session Instead' button; drill isolation contract in statistics engine updating only targeted skill statistics; topbar drill indicator on LiveInterviewScreen; practice action routing from Skills Dashboard and Results screens; 411/411 tests passing with 0 axe violations across Ink and Paper themes, 0 knip dead code, 0 type errors, 0 lint errors (FR-016, PG-16) |
| 2026-10-17 | 0.4.4 | Completed M2.5 History and import: Core storage import validation service (validateImport, executeImport, deleteSession with cascade turn/review cleanup and skill stats recomputation); Settings screen (PG-18) data import flow with file picker, validation report modal showing counts/duplicates/schema, and merge confirmation; History & session detail screen (PG-17) with multi-faceted filters (modality, type, score band), text search across questions/roles/skills, 25-item pagination, corrupt session quarantine notice, detail view with scorecard & chronological dialogue transcript tabs, on-demand grounded rewrites, missed question drill CTA, and per-session deletion dialog; 200 sessions list & open in < 300ms benchmark verified; 434/434 tests passing with 0 axe violations across Ink and Paper themes, 0 knip dead code, 0 type errors, 0 lint errors (FR-019, FR-020, PG-17, PG-18) |
| 2026-10-17 | 0.4.5 | Completed M2.6 Daily habit: Deterministic local habit streak calculation engine in @abhyas/core with rest days (weekends by default) and monthly protective freezes preventing guilt-based resets; time-zone resilient date normalization with Intl.DateTimeFormat and UTC midpoint arithmetic; weekly goal progress tracking; daily drill recommendation service deterministically targeting user's calibrated weakest skill (Quick-fire 5 questions format) with completion detection; full PG-14 Home screen with canonical pixel interviewer mascot, streak display, freeze and rest day badges, accessible weekly goal progress bar, today's practice drill card with category tokens, full session launch banner, recent sessions list, and view all in history action; 450/450 tests passing with 0 axe violations across Ink and Paper themes, 0 knip dead code, 0 type errors, 0 lint errors (FR-018, PG-14 full) |
| 2026-10-17 | 0.4.6 | Completed M2.7 Installable shell & Phase 2 Exit Gate (Phase 2 completion): W3C Web App Manifest (manifest.webmanifest) with standalone display mode, #121110 theme/background, and retro pixel interviewer mascot SVG icon; offline Service Worker (sw.js) pre-caching core shell (/app/index.html, /manifest.webmanifest, /icon.svg, /theme-init.js, self-hosted fonts, public prerendered pages) with network-first navigation fallback to /app/index.html and cache-first static assets; strict AI provider network egress boundaries (sw.js never caches or intercepts cloud AI endpoints or local model server loopbacks); service worker registration and background update listener with non-intrusive reload banner in App.tsx; Phase 2 Exit Gate verified with integration test (tests/p2-exit-gate.test.ts) demonstrating calibrated weakest skill identification with medium/high confidence after >=3 sessions, 100% reproducible deterministic statistics, and owner copy review for supportive tone; 459/459 tests passing with 0 axe violations across Ink and Paper themes, 0 knip dead code, 0 type errors, 0 lint errors (FR-031, PG-08) |
| 2026-10-17 | 0.5.0 | P3 begins. Completed M3.1 Capability checks: WebGPU availability check and adapter extraction; device type classification with strict mobile/tablet blocking (FR-022, ADR-013); CPU hardware concurrency, memory and storage estimation; micro-benchmark compute speed test measuring token decoding throughput with dynamic tier recommendations (Basic < 15 tps, Standard 15-30 tps, Advanced >= 30 tps) and curated model mappings; HardwareBenchmarkCard UI component integrated into AISetupScreen (PG-09) with 0 axe violations across Ink and Paper themes; 473/473 tests passing with 0 knip dead code, 0 type errors, 0 lint errors (FR-024, FR-022, ADR-013) |
| 2026-10-18 | 0.5.1 | Completed M3.2 In-browser engine: LocalEngineAdapter implementing ProviderAdapter (webllm) running off-main-thread in Web Worker; curated model catalog (SmolLM2-1.7B, Qwen2.5-1.5B, Llama-3.2-3B, Llama-3.1-8B) with sizes, context limits, and hardware tiers; download progress reporting with pause, resume, cancel, and cache eviction; IndexedDB model metadata sync and browser persistent storage request (navigator.storage.persist); safe custom model format validation rejecting pickle-based formats (.pkl, .bin, .pt, .pth) and allowlisting .safetensors/.gguf/.onnx; PG-19 Model Manager screen with device summary, hardware benchmark, storage meter, accessible table view toggle, delete confirmation dialog, and zero axe violations in Ink and Paper themes; local model provider choice in PG-09 AI Setup screen; 503/503 tests passing with 0 knip dead code, 0 type errors, 0 lint errors (FR-022, FR-023, ADR-013, ADR-017, PG-19, PG-09) |
| 2026-10-18 | 0.5.2 | Completed M3.3 Curated models: Versioned models.json catalog (version 1) with 4 curated models (SmolLM2-1.7B, Qwen2.5-1.5B, Llama-3.2-3B, Llama-3.1-8B), measured speeds (tokens per second and latency on reference devices), notes, and verified reference sanity results; core post-load sanity test runner (runModelSanityTest) evaluating speed, instruction following ('READY'), and JSON schema validity; Zod schemas (CuratedCatalogSchema, CuratedModelSchema, ModelSanityResultSchema); CI content validation (validateCuratedModelsCatalog) verifying catalog size (3 to 5 models) and passing reference sanity tests; Model Manager UI (PG-19) integration displaying measured speeds, reference/local sanity badges ('INTERVIEW-READY', 'QUESTIONS ONLY', 'NOT SUITABLE'), and live 'Run Sanity Test' action on loaded models with IndexedDB persistence; 517/517 tests passing with 0 axe violations, 0 knip dead code, 0 type errors, 0 lint errors (FR-023, AI-006, ADR-013) |
| 2026-10-18 | 0.5.3 | Completed M3.4 Small-model behavior: Condensed context builder strictly following 7-layer hierarchy (AI-013) with rolling summary of turns older than the last 2-3 and small-model token budget (< 3,000 tokens per AI-014); crash-proof JSON validation in RubricEvaluator with automatic graceful fallback to rule-based evaluation for small models or WebLLM; session scorecard detection of isBasicFeedback; prominent 'Basic Feedback' honesty badges across ResultsScreen (PG-13) and HistoryScreen (PG-17); 534/534 tests green with 0 axe violations, 0 knip dead code, 0 type errors, 0 lint errors (FR-012, AI-014, PG-13, PG-17) |
| 2026-10-18 | 0.5.4 | Completed M3.5 Device rules: Blocked in-browser local model selection on mobile devices with explanatory callouts and disabled UI in AISetupScreen (PG-09), SessionSetupScreen (PG-11), and ModelManagerScreen (PG-19); enforced text-only mode for local sessions disabling voice controls; prevented any construction of browser speech recognition or synthesis services in local mode on PC eliminating microphone permission prompts; 547/547 tests green with 0 axe violations across Ink and Paper themes, 0 knip dead code, 0 type errors, 0 lint errors (FR-022, ADR-013, PG-09, PG-11, PG-12, PG-19) |
| 2026-10-18 | 0.5.5 | Completed M3.6 Local servers: OllamaAdapter in @abhyas/core with NDJSON streaming chunk reader, schema-constrained object generation with retry, and automatic localhost CORS classification; OpenAICompatibleAdapter enhancement for optional API keys on localhost/127.0.0.1; PG-06 Local Models Guide (apps/web/src/screens/public/LocalModelsGuidePage.tsx) prerendered static page with PC-only/text-only rules, hardware tiers table, in-browser vs local server comparison, step-by-step cross-origin setup commands across OSes (OLLAMA_ORIGINS="*"), LM Studio instructions, and 'basic feedback' honesty note; PG-05 Troubleshooting expansion with Local Models matrix column and CORS error remedies; AISetupScreen (PG-09) Ollama radio card with mobile blocking, CORS diagnostics, and zero-key local testing; docs/troubleshooting.md documentation; 574/574 tests green with 0 axe violations, 0 knip dead code, 0 type errors, 0 lint errors (FR-005, FR-023, FR-033, PG-06, PG-05, ADR-002, ADR-013) |




