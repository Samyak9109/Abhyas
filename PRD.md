# PRD — Abhyas

| Field | Value |
| --- | --- |
| Document | `PRD.md` (authority level 1 of 4) |
| Version | 0.2.2 |
| Last updated | 2026-10-13 |
| Status | Draft, ready to build Phase 0 and Phase 1 |
| Owner | Samyak Jain |
| Companion docs | `architecture.md`, `design.md`, `phases.md` |

---

## 0. Governing Specification Rules (read first)

These four files are the project's single source of truth. They apply to every human and AI coding agent (for example Antigravity) working on this repository.

### 0.1 Precedence

When documents conflict, the higher one wins:

`PRD.md` → `architecture.md` → `design.md` → `phases.md` → existing implementation

Exception: a deliberate decision recorded in `architecture.md` (an ADR) is preserved even if older code disagrees, unless the owner explicitly instructs otherwise.

### 0.2 When something is unclear

1. Check `PRD.md`.
2. Check `architecture.md`.
3. Check `design.md`.
4. Check `phases.md`.
5. Inspect the existing implementation.
6. Only then make the smallest reasonable decision, record it in the relevant document's change log, and flag it in the pull request.

Never make major architectural, UX, product or scope decisions from assumptions alone.

### 0.3 Decision status labels

| Label | Meaning | Agent behavior |
| --- | --- | --- |
| `[DECIDED]` | Explicitly confirmed by the owner | Follow. Change only on explicit owner instruction. |
| `[DEFAULT]` | Recommended during planning, not yet confirmed | Follow. Replace only through a recorded decision (ADR) with the owner's approval. |
| `[OPEN]` | Unresolved | Do not guess. Ask the owner, or build behind an interface so the choice stays reversible. |

### 0.3.1 Stable IDs

- Functional requirements: `FR-###`. Non-functional: `NFR-###`. Journeys: `J-##`. AI requirements: `AI-###`. Decisions: `ADR-###` (in `architecture.md`). Phases: `P#`. Milestones: `M#.#`. Pages and screens: `PG-##`.
- IDs are never reused or renumbered. A removed requirement is marked `Deprecated` and keeps its ID.
- Code, tests and pull requests should reference IDs (for example `// FR-012`).

### 0.4 Maintenance protocol

- Any change to behavior, architecture, design or scope updates the relevant document in the same pull request.
- Each file has a change log at its end. Append, do not rewrite history.
- Do not silently expand scope. New ideas go to section 12 (Parking Lot) until the owner approves them.
- Agents also follow `architecture.md` sections 24.6 to 24.8: no dead code, token economy (read only the sections a task references), and skills applied automatically with tools used only when needed. The owner does not have to invoke skills or tools.

---

## 1. Product Overview

### 1.1 Name
**Abhyas** (अभ्यास: Hindi and Sanskrit for "practice"). `[DECIDED]` 2026-10-13. Earlier working title: Interview Practice Agent. The name "DryRun" was rejected because an existing AI interview-prep product uses it. Descriptor used with the name: "interview practice". `[OPEN]` Domain and handle availability, a trademark search (a common word meaning "practice" is crowded and may be weak as a mark; get professional advice), and the logo. Keep the name in one config constant so it can change cheaply.

### 1.2 One-line description
A free, private, open-source web app where people practice job interviews out loud with an AI interviewer that knows their resume, the job description and the target company, then shows which skills to improve.

### 1.3 Problem
Most candidates get little or no realistic interview practice. Human mock interviewers are scarce and expensive. Reading question lists gives no speaking practice. Generic chatbots forget past sessions, do not track skill growth, and give inconsistent feedback. Existing AI mock-interview tools often require accounts, upload resumes to a vendor server, lock users to one AI model, or bundle practice into a paid product.

### 1.4 Why it matters
Interview performance strongly affects career outcomes, and delivery (clear, structured, confident answers) is a learnable skill that improves with repeated, feedback-rich practice. Students and early-career candidates, especially in markets with campus placement, have the least access to coaching.

### 1.5 Target users
- Primary: students and early-career job seekers (fresher to 3 years) preparing for technical and HR interviews.
- Secondary: mid and senior engineers preparing for role changes, privacy-conscious users, and users who want to run local AI models.
- Tertiary: coaches, bootcamps and placement cells who self-host or reuse the open-source code (MIT license permits this; commercial use of the code is not restricted).

### 1.6 Primary use cases
1. Practice a full mock interview by voice (or text) tailored to a resume, job description, experience level and optionally a company.
2. See which skills are weakest and strongest, with honest confidence levels.
3. Drill a single skill with calibrated difficulty.
4. Build a practice habit leading up to a real interview date.
5. Practice privately: nothing is stored on a server, and a fully local mode exists.

### 1.7 Product vision
The best private place to practice interviews: honest feedback, visible progress over time, any AI model, and no lock-in or accounts.

### 1.8 Product goals

| ID | Goal | Measure (initial targets, tune after real usage) |
| --- | --- | --- |
| G-1 | Fast start | A new user with an API key reaches the first question in under 3 minutes |
| G-2 | Repeat use | At least 40% of users who finish one session finish a third within 14 days |
| G-3 | Useful feedback | At least 70% of surveyed users rate feedback "useful" or better |
| G-4 | Trustworthy privacy | Zero resume, transcript or key data reaches the project's servers (verified by automated network test) |
| G-5 | Model freedom | Works with at least 3 AI sources at MVP (Gemini, OpenAI, any OpenAI-compatible endpoint) |
| G-6 | Sustainable cost | Project-side AI spend stays within a hard daily cap (company research only) |

Metrics are gathered without telemetry: through opt-in surveys, GitHub signals and manual tests. See NFR-017.

### 1.9 Non-goals (v1)
- Accounts, sign-in, cross-device server sync.
- Providing a shared AI key for interviewing. `[DECIDED]`
- A live-interview "copilot" that assists during real interviews.
- Video analysis, coding editor rounds (Parking Lot).
- Payments or paid tiers (not planned; MIT license) `[DECIDED]`.
- Hiring decisions, employer-side screening.

### 1.10 Brand and visual direction `[DECIDED]`
The owner approved a retro-pixel visual direction on 2026-10-13: near-black "ink" ground with warm cream "paper" bands, one orange accent, pixel display type, monospaced labels, hairline borders, square corners, and a pixel monitor-head mascot as the interviewer. The four typefaces (Pixelify Sans, Instrument Sans, JetBrains Mono, Caveat) are fixed. Details and rules are in `design.md`; the approved visuals are in the design canvas referenced there. The product name is Abhyas; the mascot's name and the final logo remain `[OPEN]`.

---

## 2. User Personas

Personas are design archetypes, not real individuals.

### P-A — Aarav, campus placement candidate
| Attribute | Detail |
| --- | --- |
| Technical ability | Medium. Comfortable with apps, never used an API key. |
| Goals | Crack service and product company interviews; improve spoken English; practice HR rounds. |
| Pain points | Cannot pay for coaching; freezes when speaking; unsure which answers are weak. |
| Typical workflow | Opens app on a laptop, uploads resume, pastes a job description, practices 15 minutes a day for two weeks before drives. |
| Expected behavior | Wants guided setup; may need the free-key guide or a local model; low-spec laptop. |
| Success | Starts a session within minutes, sees measurable improvement in structure and filler words, feels more confident. |

### P-B — Meera, junior developer switching jobs
| Attribute | Detail |
| --- | --- |
| Technical ability | High. Has a free Gemini key. |
| Goals | Practice behavioral and system design answers for a specific company. |
| Pain points | Generic questions; no company context; no memory of past sessions. |
| Workflow | Picks a company, runs mixed sessions, checks weak skills, drills them. |
| Behavior | Uses voice on desktop and mobile; cares about score trends. |
| Success | Weak-skill score rises across sessions; interview questions feel familiar. |

### P-C — Rohan, privacy-focused senior engineer
| Attribute | Detail |
| --- | --- |
| Technical ability | Very high. Runs local models. |
| Goals | Practice senior-level scenarios without sending data to cloud providers. |
| Pain points | Distrust of tools that upload resumes; wants model choice. |
| Workflow | Uses local model mode (text), custom model, exports data for backup. |
| Behavior | Inspects network traffic and source code. |
| Success | Verifies nothing leaves the device; gets level-appropriate depth. |

### P-D — Sana, coach or placement-cell lead
| Attribute | Detail |
| --- | --- |
| Technical ability | Medium. |
| Goals | Offer students a free practice tool; self-host it for a cohort. |
| Pain points | Cannot afford per-seat tools; students lack API keys. |
| Workflow | Deploys the static build, shares link, points students to the key guide. |
| Behavior | Reads documentation, forks the repo. |
| Success | Students use it without support requests. |

---

## 3. Core User Journeys

All journeys must also handle: browser refresh mid-flow (state recovered from local storage where stated), loss of network, and slow providers.

### J-01 First run and AI setup (FR-005, FR-021)

| Step | Detail |
| --- | --- |
| Entry point | First visit, or any attempt to start a session with no AI source configured |
| User action | Chooses an AI source: paste a key, open the free-key guide, or (PC only) download a local model. Pastes key, presses Test. |
| System response | Validates key format, sends one minimal request directly from the browser to the provider, shows the result, stores the key locally (optionally encrypted with a passphrase). |
| Data required | Provider id, API key, optional base URL, model id |
| Success state | "Connected" status on the provider card; user proceeds to profile setup |
| Failure state | Specific message per cause: invalid key, quota exceeded, network error, browser blocked by provider (CORS), unsupported model |
| Empty state | No provider configured: session start is blocked and links to setup |
| Loading state | "Testing connection…" with a 10-second timeout |
| Recovery path | Edit key, switch provider, open free-key guide, choose local model, retry |

### J-02 Voice practice session (FR-006 to FR-013)

| Step | Detail |
| --- | --- |
| Entry point | Home → Start session, or Daily drill |
| User action | Confirms setup, allows microphone, answers using push-to-talk, edits transcript, submits; may repeat, skip, ask for a hint, pause or end |
| System response | Generates and streams the question, speaks it, shows subtitles, transcribes the answer, scores it, asks a follow-up or the next question, then builds a scorecard |
| Data required | Parsed profile (resume summary, job description), level, interview type, optional company pack, provider config |
| Success state | All planned questions answered (or user ended); scorecard and transcript saved locally |
| Failure state | Microphone denied or unsupported; provider error mid-session; scoring output invalid; browser tab closed |
| Empty state | No resume or job description: allow a role-only general session |
| Loading state | "Preparing your question…" (skeleton + thinking indicator); "Scoring your answers…" |
| Recovery path | Switch to typing; retry the failed call (up to 2 automatic retries); save partial results; user can discard or keep |

### J-03 Text-only local-model session (FR-022, FR-011)

| Step | Detail |
| --- | --- |
| Entry point | Provider set to a local model on a PC |
| User action | Reads questions, types answers, watches a per-question countdown |
| System response | Streams tokens from the local model; no speech input or output; applies condensed context |
| Data required | Downloaded model, condensed profile, optional company pack |
| Success state | Session completes with a "basic feedback" scorecard (see FR-012) |
| Failure state | WebGPU missing; out-of-memory; model too slow; tab crash |
| Empty state | No model downloaded: opens Model manager |
| Loading state | Model download progress, model load, first-token wait |
| Recovery path | Pick a smaller model, switch to an API key, retry |

### J-04 Review skills and drill (FR-014 to FR-017)

| Step | Detail |
| --- | --- |
| Entry point | Skills dashboard or Home "weakest skill" card |
| User action | Views skill scores, opens a skill, starts a drill |
| System response | Aggregates local data, shows scores with confidence, builds a 5 to 10 question drill at calibrated difficulty |
| Data required | Stored turns and skill statistics |
| Success state | Drill completes; skill statistics update |
| Failure state | Not enough data for a skill |
| Empty state | No sessions yet: explains and links to starting a session |
| Loading state | Aggregation under 1 second (local) |
| Recovery path | Run a general session to collect data |

### J-05 Company selection and request (FR-025, FR-026)

| Step | Detail |
| --- | --- |
| Entry point | Session setup → Company picker |
| User action | Searches a company; selects it; if absent, presses Request |
| System response | Looks up pack status. Ready: loads the pack and tailors the session. Not available: records the request (company name only) and offers a general session |
| Data required | Company slug, optional official domain |
| Success state | Pack loaded and session tailored, or request recorded ("Requested ✓") |
| Failure state | Backend unreachable; rate limited; company cannot be validated |
| Empty state | No match in search |
| Loading state | Pack fetch; research queued message |
| Recovery path | Continue with a general session; retry later |

### J-06 Schedule practice (FR-027)

| Step | Detail |
| --- | --- |
| Entry point | Schedule screen |
| User action | Enters interview date and cadence; exports a calendar file or connects Google Calendar |
| System response | Generates a preparation plan with ramping difficulty; creates `.ics` or calendar events |
| Data required | Interview date, time zone, cadence |
| Success state | File downloaded or events created |
| Failure state | OAuth denied or app unverified; API error |
| Empty state | No date set: shows a generic weekly plan |
| Loading state | "Creating events…" |
| Recovery path | Fall back to `.ics` export |

### J-07 Data export, import and deletion (FR-020)

| Step | Detail |
| --- | --- |
| Entry point | Settings → Data |
| User action | Exports JSON, imports JSON, or deletes everything |
| System response | Writes or reads a versioned JSON backup; deletion requires typed confirmation |
| Data required | All local tables |
| Success state | File saved, import merged, or data wiped |
| Failure state | Invalid or newer-version file; storage full |
| Empty state | Nothing to export |
| Loading state | Progress for large exports |
| Recovery path | Import validation report; keep existing data on failure |

---

## 3A. Page and Screen Inventory

Canonical list of every page the product needs. IDs are stable. Visual specifications are in `design.md` section 8; build order and design-readiness are in `phases.md` section 6A. "Public" pages are static and prerendered (NFR-012); "App" pages run in the local-first application.

| ID | Page | Type | Purpose | Related FR | Phase |
| --- | --- | --- | --- | --- | --- |
| PG-01 | Landing | Public | Explain the product honestly and send visitors to start | FR-033, FR-021 | P1 |
| PG-02 | Privacy | Public | State what stays on the device and what leaves it | FR-033, FR-021 | P1 |
| PG-03 | Open source and license | Public | MIT license, source link, contributing, trademark note | FR-033 | P1 |
| PG-04 | Key guide | Public | Help users obtain and paste an API key per provider | FR-033, FR-005 | P1 |
| PG-05 | Troubleshooting and compatibility | Public | Browser support matrix, error causes and fixes | FR-033 | P1 (expanded in P3) |
| PG-06 | Local models guide | Public | Explain local mode, hardware tiers, local-server setup | FR-033, FR-022 | P3 |
| PG-07 | Roadmap and changelog | Public | Show status and release notes (Could) | FR-033 | P2 |
| PG-08 | Not-found, unsupported-browser and offline pages | Public and App | Handle dead ends without losing the user | FR-033, FR-031 | P1 |
| PG-09 | AI setup (step 1 of 3) | App | Connect an AI source | FR-005, FR-021, FR-032 (local option: FR-022) | P1 (local option P3) |
| PG-10 | Profile and documents (step 2 of 3) | App | Resume, job description, level, role | FR-002, FR-003, FR-004 | P1 |
| PG-11 | Session setup with company choice (step 3 of 3) | App | Configure and start a session | FR-006, FR-025 | P1 (company choice P4) |
| PG-12 | Live interview (voice, text, drill modes) | App | Run the interview | FR-008 to FR-011 | P1 |
| PG-13 | Results | App | Scorecard, fixes, transcript | FR-012, FR-013 | P1 |
| PG-14 | Home | App | Start point, recent sessions, daily drill | FR-018 | P1 (minimal), P2 (full) |
| PG-15 | Skills dashboard | App | Strengths, gaps, confidence, trends | FR-014, FR-015 | P2 |
| PG-16 | Skill practice | App | Drill one skill | FR-016 | P2 |
| PG-17 | History and session detail | App | Review past sessions | FR-019 | P2 |
| PG-18 | Settings | App | Providers, voice, appearance, data, privacy, diagnostics, about | FR-020, FR-021, FR-030 | P1 |
| PG-19 | Model manager | App | Manage local models | FR-022, FR-023, FR-024 | P3 |
| PG-20 | Company directory and detail | App | Browse company packs with sources | FR-025 | P4 |
| PG-21 | Report and request dialogs | App | Request research, report wrong data | FR-026, FR-029 | P5 (issue-link variant in P4) |
| PG-22 | Schedule | App | Interview date, practice plan, calendar | FR-027 | P6 |
| PG-23 | Review queue | App | Revisit missed questions | FR-028 | P6 |

Notes:
- The earlier standalone "Welcome" screen is replaced by PG-01.
- Dialogs and sheets inside a page (for example end-session confirmation) are part of that page, not separate inventory items.
- Adding or removing a page requires a change here first, then in `design.md` section 8 and `phases.md` section 6A.

---

## 4. Functional Requirements

Field legend: **Auth** = authentication or permission needed. Because the product has no accounts, most features need none; the only credentials are the user's own AI provider keys and, optionally, Google Calendar consent.
Priority: Must (needed for the phase to pass), Should, Could. Phase codes are defined in `phases.md`.

### FR-001 — Local-first data store and migrations
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Persist all user data in the browser so no account is needed.
- **User story:** As a user, I want my sessions and progress saved on my device so I can return without signing in.
- **Inputs:** Writes from every feature.
- **Outputs:** Persisted tables: `profile`, `documents`, `sessions`, `turns`, `skillStats`, `reviewQueue`, `settings`, `companyCache`, `models`.
- **Business logic:** IndexedDB through a single data-access layer. Integer schema version, forward-only migrations. Request persistent storage on first save. One transaction per turn write.
- **Validation:** Every row is parsed with its schema on read. Corrupt rows move to a quarantine table and are never silently dropped.
- **Errors:** Quota exceeded → warn and prompt export. IndexedDB unavailable → in-memory mode with a visible banner.
- **Auth:** None.
- **Dependencies:** ADR-004 (storage), FR-020.
- **Edge cases:** Browser evicts storage; two tabs open; user opens an older app version against newer data (refuse and explain).
- **Acceptance:** Data written by version N loads in N+1 with migrations and no loss (automated test); data survives reload; in-memory fallback shows the banner.

### FR-002 — Resume and job description ingestion
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Get the user's resume and the target job description into the app privately.
- **User story:** As a candidate, I want to upload my resume and paste a job description so questions fit me.
- **Inputs:** Resume as PDF, DOCX or pasted text; job description as pasted text; optional "role only" mode with no documents.
- **Outputs:** Extracted plain text, editable by the user, stored locally.
- **Business logic:** Parse in the browser only. Show extracted text for review. Job description URL fetching is not supported (browser cross-origin limits).
- **Validation:** Allowed types PDF, DOCX, TXT. Max 5 MB. Non-empty text. Job description over the token budget is truncated with a visible notice.
- **Errors:** Parse failure → offer paste. Scanned (image-only) PDF → explain that OCR is not supported in v1.
- **Auth:** None.
- **Dependencies:** FR-001.
- **Edge cases:** Multi-column layouts, non-English text, password-protected PDFs, very long documents.
- **Acceptance:** A sample PDF and DOCX each produce editable text. An automated test confirms no network request occurs during parsing.

### FR-003 — Structured profile extraction
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Turn resume and job description into a compact structured profile reused every turn.
- **User story:** As a candidate, I want the interviewer to know my skills and gaps without resending my whole resume each time.
- **Inputs:** Resume text, job description text.
- **Outputs:** `StructuredProfile` (skills, projects, quantified claims, gaps versus the job description) and a condensed form within the token budget (target at most 1,200 tokens).
- **Business logic:** One AI call with a JSON schema, cached by hash of inputs. Regenerate only when inputs change. User may edit the result.
- **Validation:** Schema-validated; one retry on failure.
- **Errors:** Fall back to keyword extraction plus manual skill entry.
- **Auth:** Provider key (FR-005) unless local model.
- **Dependencies:** FR-002, FR-005.
- **Edge cases:** No job description; contradictory dates; very sparse resume.
- **Acceptance:** Profile is editable and persisted; unchanged inputs do not trigger a new AI call; condensed form fits the budget in tests.

### FR-004 — Experience level and target role
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Calibrate everything to the user's stated level.
- **User story:** As a fresher, I want questions at my level, not senior system design.
- **Inputs:** Level (intern/fresher, junior 1 to 3 years, mid 3 to 5, senior 5 to 8, staff or above), target role or field, optional years.
- **Outputs:** Calibration band consumed by FR-007, FR-012, FR-017.
- **Business logic:** Level is required before the first session and editable anytime.
- **Validation:** Role text at most 100 characters.
- **Errors:** None expected; invalid input blocks the Start button with an inline message.
- **Auth:** None.
- **Dependencies:** FR-001.
- **Edge cases:** Career changers; user picks a level far from resume evidence (show a gentle note on results, never block).
- **Acceptance:** Changing level changes question difficulty distribution in the next session (unit test on selection).

### FR-005 — AI provider configuration (bring your own key)
- **Phase:** P1 (Gemini, OpenAI, OpenAI-compatible) · P3/P7 (Ollama, Claude, Hugging Face) · **Priority:** Must `[DECIDED]`
- **Purpose:** Let users choose their AI source with their own credentials. The project provides no AI for interviewing.
- **User story:** As a user, I want to use my own key or model so I control cost and privacy.
- **Inputs:** Provider, API key, optional base URL, model id; optional separate model per role (interviewer, evaluator).
- **Outputs:** Validated provider config with capability flags (streaming, JSON mode, context length).
- **Business logic:** Calls go directly from the browser to the provider. Model lists come from the provider's list endpoint, never hard-coded. Keys may be encrypted at rest with a user passphrase (WebCrypto). Keys are never logged or sent anywhere except the provider origin.
- **Validation:** Non-empty key. Base URL must be https (http allowed only for localhost).
- **Errors:** Classified messages: invalid key, quota, network, blocked by provider (CORS), model not found.
- **Auth:** The user's provider key.
- **Dependencies:** ADR-002, ADR-005.
- **Edge cases:** Key revoked mid-session; provider outage; provider deprecates a model.
- **Acceptance:** Test button succeeds for Gemini and an OpenAI-compatible endpoint. Automated test proves keys appear only in requests to the configured provider origin.

### FR-006 — Interview session setup
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Configure a session in one screen.
- **User story:** As a user, I want to pick interview type and length quickly.
- **Inputs:** Type (HR/behavioral, technical, system design, DSA verbal, mixed), difficulty (default from level), interviewer style (friendly, standard, strict), length (5, 10 or 15 questions), input mode (voice or text), optional company.
- **Outputs:** `SessionPlan`.
- **Business logic:** Voice is offered only when the device and AI source allow it (see FR-022). Defaults chosen from profile.
- **Validation:** Required fields present; incompatible combinations blocked with explanation.
- **Errors:** Missing provider → link to FR-005.
- **Auth:** None.
- **Dependencies:** FR-003, FR-004, FR-005.
- **Edge cases:** No profile (role-only session); company pack unavailable.
- **Acceptance:** A valid plan starts a session; incompatible combinations cannot be submitted.

### FR-007 — Question engine
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Choose reliable, level-appropriate questions and personalize them.
- **User story:** As a user, I want relevant questions that probe my real experience.
- **Inputs:** `SessionPlan`, profile, skill statistics, optional company pack.
- **Outputs:** Question objects: id, skill tags, difficulty (1 to 5), text, rationale.
- **Business logic:** Select from a curated, tagged question bank weighted by job-description gaps and weak skills. The AI only rewrites for personalization and adds resume or company references. It never assigns difficulty. Avoid repeats from recent sessions.
- **Validation:** All tags exist in the taxonomy (FR-014).
- **Errors:** Empty bank for a skill → AI-generated question flagged "unverified" and excluded from calibrated stats.
- **Auth:** Provider key unless local.
- **Dependencies:** FR-014, FR-017, FR-025.
- **Edge cases:** Tiny bank early on; resume with no matching skills.
- **Acceptance:** In a 10-question session at least 90% of questions trace to bank ids or are flagged; no repeats from the last 3 sessions when the bank allows.

### FR-008 — Interview orchestration
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Run the interview as a predictable state machine.
- **User story:** As a user, I want a natural flow with follow-ups, not a quiz.
- **Inputs:** Questions, answers, evaluator output.
- **Outputs:** Ordered turns, follow-ups, session status.
- **Business logic:** States: setup, intro, ask, await_answer, evaluate, follow_up_or_next, wrap_up, results. At most 2 follow-ups per question, triggered by shallow depth or a resume claim worth probing. Difficulty adapts within the level band by at most one step. Supports pause, repeat, skip, hint, end. Timers optional.
- **Validation:** Illegal transitions are rejected in code.
- **Errors:** Provider failure moves to a recoverable state with retry, switch-to-text and save-partial options.
- **Auth:** None.
- **Dependencies:** FR-007, FR-012.
- **Edge cases:** Long silence; answer over 3 minutes (voice) or 2,000 characters (text); double submit; tab closed mid-session.
- **Acceptance:** Unit tests cover every transition and every failure path; the machine never reaches an unreachable state.

### FR-009 — Voice input
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Let users answer out loud.
- **User story:** As a user, I want to speak my answers and fix transcription errors before they are scored.
- **Inputs:** Microphone audio.
- **Outputs:** Editable transcript.
- **Business logic:** Push-to-talk using the browser speech recognition API in the MVP. Interim text shown live. The user reviews and edits before submit. Later phases may add on-device Whisper and automatic end-of-speech detection.
- **Validation:** Microphone permission checked; unsupported browsers fall back to text.
- **Errors:** Permission denied → instructions to re-enable; recognition failure → retry or type.
- **Auth:** Browser microphone permission.
- **Dependencies:** FR-021 (disclosure that some browsers process speech in the cloud).
- **Edge cases:** Accents and noise; recognition auto-stopping on silence; mobile browser quirks.
- **Acceptance:** Voice works in current Chrome and Edge on desktop and Chrome on Android; text fallback works everywhere; the transcript is always editable before scoring.

### FR-010 — Voice output and subtitles
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Speak questions and show subtitles for both speakers.
- **User story:** As a user, I want to hear the question and read it too.
- **Inputs:** Question text, user transcript.
- **Outputs:** Speech audio and live subtitles.
- **Business logic:** Browser speech synthesis in the MVP, split by sentence for lower delay. Subtitles on by default, optional toggle, never removed entirely from the question text. Speed control and mute.
- **Validation:** Audio starts only after a user gesture (mobile policy).
- **Errors:** Synthesis unavailable → text only, no error dialog.
- **Auth:** None.
- **Dependencies:** FR-008.
- **Edge cases:** Missing voices for a language; long questions.
- **Acceptance:** Subtitle text equals spoken text; with audio off the full question remains visible.

### FR-011 — Text-only interview mode
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Support typing as a fallback and as the only mode for local models.
- **User story:** As a user without a microphone or with a local model, I want the same interview by typing.
- **Inputs:** Typed answers.
- **Outputs:** Same turns and scoring as voice, minus speech metrics.
- **Business logic:** Per-question countdown, word counter, streaming interviewer text. Text sessions are tagged `modality=text`; delivery skills (pacing, filler words) are excluded from their statistics.
- **Validation:** Minimum answer length warning (not a block).
- **Errors:** Same as FR-008.
- **Auth:** None.
- **Dependencies:** FR-008, FR-012.
- **Edge cases:** Pasted answers (allowed, flagged only if the user asks).
- **Acceptance:** A full session completes with no microphone; delivery metrics are absent and not penalized.

### FR-012 — Answer evaluation and rubric scoring
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Give consistent, explainable feedback.
- **User story:** As a user, I want to know exactly why an answer scored the way it did.
- **Inputs:** Question, answer, level, skill tags, optional company values, rubric.
- **Outputs:** Per-criterion scores (relevance, structure, depth and accuracy, clarity, level fit), each 1 to 5, with a short explanation and an excerpt from the user's own answer as evidence; skill attributions; local delivery metrics (voice only: words per minute, filler words, pauses, length).
- **Business logic:** Fixed rubric with level-specific anchor descriptions. Temperature 0. Schema-constrained JSON output. A reduced "basic feedback" path for small local models: rule-based metrics plus a simplified rubric, labeled as basic.
- **Validation:** Schema validation, one retry; otherwise the turn is marked `unscored` and excluded from statistics.
- **Errors:** Never crash the session on bad model output.
- **Auth:** Provider key unless local.
- **Dependencies:** FR-017, ADR-006.
- **Edge cases:** Empty or one-word answers; non-English answers; transcription errors.
- **Acceptance:** On a labeled golden set of at least 20 transcripts, two runs at temperature 0 differ by a mean absolute score of 0.5 or less; invalid output paths are covered by tests.

### FR-013 — Session results and scorecard
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Summarize the session and say what to fix.
- **User story:** As a user, I want a clear scorecard and top actions.
- **Inputs:** Session turns and scores.
- **Outputs:** Overall score, per-criterion view, top three fixes, per-answer feedback, "stronger answer" suggestions grounded only in facts from the user's profile, full transcript.
- **Business logic:** Rewrites must not invent experience; claims absent from the profile are flagged as unsupported. A note appears if scores suggest a different level than selected.
- **Validation:** Results saved only after the session ends or is ended early.
- **Errors:** Partial sessions show partial results with a notice.
- **Auth:** None.
- **Dependencies:** FR-012, FR-001.
- **Edge cases:** Sessions with unscored turns.
- **Acceptance:** Results screen renders for full, partial and text-only sessions; no rewrite contains a claim absent from the profile (checked by tests on fixtures).

### FR-014 — Skill taxonomy and statistics
- **Phase:** P1 (tags) · P2 (statistics) · **Priority:** Must
- **Purpose:** Measure skills across sessions.
- **User story:** As a user, I want to know my weakest and strongest skills.
- **Inputs:** Scored turns with skill tags.
- **Outputs:** Per-skill score, number of answers `n`, confidence, last practiced date, trend.
- **Business logic:** Versioned taxonomy file: technical (DSA, system design, databases, backend and APIs, frontend, ML and AI, cloud and DevOps, language-specific), behavioral (communication, ownership, conflict, leadership), delivery (clarity, pacing, filler words). Rating uses a recency-weighted mean. Confidence is low when `n` is below 3.
- **Validation:** Tags must exist in the taxonomy.
- **Errors:** Unknown tag → turn kept, excluded from stats, logged locally.
- **Auth:** None.
- **Dependencies:** FR-012.
- **Edge cases:** Few answers per skill; taxonomy changes between versions (migration maps old to new tags).
- **Acceptance:** Statistics are recomputed deterministically from stored turns; "weakest" excludes low-confidence skills unless nothing else exists.

### FR-015 — Skills dashboard
- **Phase:** P2 · **Priority:** Must
- **Purpose:** Visualize strengths and gaps honestly.
- **User story:** As a user, I want one place to see where I stand.
- **Inputs:** Skill statistics.
- **Outputs:** Skill chart, weakest and strongest lists, trend lines, stale-skill markers, benchmark against level.
- **Business logic:** Always show confidence. Copy labels results as guidance, not verdicts.
- **Validation:** None.
- **Errors:** Not enough data → explanatory empty state.
- **Auth:** None.
- **Dependencies:** FR-014.
- **Edge cases:** One-session users; skills never practiced.
- **Acceptance:** Dashboard renders for zero, one and many sessions; low-confidence skills are visibly marked.

### FR-016 — Skill-wise practice
- **Phase:** P2 · **Priority:** Must
- **Purpose:** Drill one skill at a time.
- **User story:** As a user, I want a short drill on my weakest skill.
- **Inputs:** Chosen skill or "Fix my weakest".
- **Outputs:** A drill of 5 to 10 questions.
- **Business logic:** Formats: quick-fire (short answers) and deep-dive (follow-up chains). "Fix my weakest" picks the lowest score adjusted for confidence.
- **Validation:** Skill must have bank questions at the user's level.
- **Errors:** No questions available → suggest a mixed session.
- **Auth:** None.
- **Dependencies:** FR-007, FR-014.
- **Edge cases:** All skills low confidence.
- **Acceptance:** A drill runs and updates only the targeted skills' statistics.

### FR-017 — Difficulty calibration by experience level
- **Phase:** P2 · **Priority:** Must `[DECIDED]`
- **Purpose:** Make "fresher" and "senior" sessions genuinely different.
- **User story:** As a mid-level engineer, I want trade-off questions, not definitions.
- **Inputs:** Level band, skill statistics, question tags.
- **Outputs:** Question difficulty distribution and level-specific rubric anchors.
- **Business logic:** Calibrate on five axes: depth, ambiguity, expected scope, follow-up pressure, behavioral expectations. Rubric anchors describe what a good answer looks like at each level. Adaptive difficulty moves within the band by at most one step per answer.
- **Validation:** Every bank question carries level and difficulty tags.
- **Errors:** Missing tags → question not selectable.
- **Auth:** None.
- **Dependencies:** FR-004, FR-007, FR-012.
- **Edge cases:** User far above or below the chosen level.
- **Acceptance:** Difficulty distributions differ measurably between fresher and senior plans (unit test); the same answer can score differently by level against the anchors (fixture test).

### FR-018 — Daily check-in and streaks
- **Phase:** P2 · **Priority:** Should `[DECIDED]`
- **Purpose:** Build a practice habit without accounts.
- **User story:** As a user, I want a small daily goal and a visible streak.
- **Inputs:** Completed sessions and drills.
- **Outputs:** Streak count, daily drill suggestion, weekly goal progress.
- **Business logic:** All local. Daily drill targets the weakest skill. Rest days and freezes prevent guilt-based design. Badges, if any, reflect real improvement, not logins.
- **Validation:** Uses the device's local date; handles time zone changes.
- **Errors:** Clock tampering is ignored (no server to enforce).
- **Auth:** None.
- **Dependencies:** FR-014, FR-016.
- **Edge cases:** Travel across time zones; clearing site data resets the streak (communicated in settings).
- **Acceptance:** Streak logic passes unit tests for rest days, freezes and time zone shifts.

### FR-019 — History and transcripts
- **Phase:** P2 · **Priority:** Must
- **Purpose:** Let users revisit past sessions.
- **User story:** As a user, I want to reread my answers and see how I improved.
- **Inputs:** Stored sessions and turns.
- **Outputs:** Session list, filters, transcript and score detail, replay of missed questions.
- **Business logic:** Delete a single session or all history.
- **Validation:** None.
- **Errors:** Corrupt session → quarantined with a notice.
- **Auth:** None.
- **Dependencies:** FR-001, FR-013.
- **Edge cases:** Hundreds of sessions (virtualized list).
- **Acceptance:** List and detail views load within 300 ms for 200 stored sessions on a mid-range laptop.

### FR-020 — Data export, import and deletion
- **Phase:** P1 (export, delete) · P2 (import) · **Priority:** Must
- **Purpose:** Give users control and a backup path.
- **User story:** As a user, I want to back up or erase everything.
- **Inputs:** User action in Settings.
- **Outputs:** Versioned JSON file; merged import; empty store after deletion.
- **Business logic:** Export excludes API keys by default (explicit opt-in to include, with passphrase). Import validates schema version and shows a report before merging. Delete requires typed confirmation.
- **Validation:** Schema and version checks.
- **Errors:** Invalid or newer-version file → refuse with explanation, existing data untouched.
- **Auth:** None.
- **Dependencies:** FR-001.
- **Edge cases:** Storage full during import; duplicate sessions.
- **Acceptance:** Export then import into a clean browser reproduces the original data (automated test).

### FR-021 — Privacy disclosures and consent
- **Phase:** P1 · **Priority:** Must `[DECIDED]`
- **Purpose:** Be honest about what leaves the device.
- **User story:** As a user, I want to know where my data goes.
- **Inputs:** Current configuration (provider, voice mode, company feature).
- **Outputs:** Context-specific notices: data stays in this browser; with a cloud key the resume and answers go to the chosen provider; some browsers process speech in their cloud; local mode sends nothing; company research sends only the company name.
- **Business logic:** Notice appears at setup and before first voice use; a full privacy page is in Settings.
- **Validation:** None.
- **Errors:** None.
- **Auth:** None.
- **Dependencies:** FR-005, FR-009, FR-026.
- **Edge cases:** User changes provider later (notice updates).
- **Acceptance:** Each configuration shows its matching notice; wording is reviewed against actual network behavior at every release.

### FR-022 — Local model mode (PC, text only)
- **Phase:** P3 · **Priority:** Should `[DECIDED]`
- **Purpose:** Let users with no key run a model on their own PC.
- **User story:** As a user with no API key, I want to download a model and practice offline.
- **Inputs:** Selected local model.
- **Outputs:** Text-only interviews powered by the local model.
- **Business logic:** Default engine runs in the browser (WebGPU). Local mode is disabled on phones. On PC it is text-only, with no speech input or output, so the model gets the device's resources. Uses condensed context, constrained JSON output and the "basic feedback" path where the model is weak.
- **Validation:** Device must pass FR-024 checks.
- **Errors:** Unsupported device → explain and offer an API key or the free-key guide.
- **Auth:** None.
- **Dependencies:** FR-023, FR-024, FR-011.
- **Edge cases:** Tab backgrounded; battery saver; memory pressure; model cache evicted.
- **Acceptance:** On a supported PC a full text session completes offline after download; on a phone, local mode is not selectable and a clear message is shown.

### FR-023 — Model manager and custom models
- **Phase:** P3 (curated) · P7 (custom, Ollama) · **Priority:** Should `[DECIDED]`
- **Purpose:** Manage downloads and allow user-chosen models.
- **User story:** As a power user, I want to bring any model my engine supports.
- **Inputs:** Curated model list; custom model identifier (repository id, Ollama tag or endpoint URL).
- **Outputs:** Installed models with size, speed rating, status.
- **Business logic:** Curated list lives in a versioned file. Custom models: user picks the engine first; app validates format compatibility, shows size, license and fit estimate, accepts only safe file formats (safetensors, GGUF, ONNX), runs a short post-load sanity test (speed, JSON validity, instruction following) and labels the model "interview-ready", "questions only" or "not suitable". Storage meter, delete, persistent-storage request. Custom models are labeled unverified.
- **Validation:** Reject unsafe formats (for example pickle-based files).
- **Errors:** Download failure → resume; incompatible format → clear message.
- **Auth:** Optional user token for gated repositories, stored locally only.
- **Dependencies:** FR-022, FR-024.
- **Edge cases:** Gated models; missing chat template; huge models.
- **Acceptance:** A curated model downloads, loads, passes the sanity test and can be deleted; an unsafe file type is rejected.

### FR-024 — Hardware detection and benchmark
- **Phase:** P3 · **Priority:** Should
- **Purpose:** Recommend a model the device can actually run.
- **User story:** As a user, I want a recommendation that will not freeze my laptop.
- **Inputs:** Browser capability checks, optional user-reported RAM, a short speed test.
- **Outputs:** Recommended tier and a speed rating (tokens per second).
- **Business logic:** Browsers expose limited memory information, so a measured speed test drives the recommendation.
- **Validation:** None.
- **Errors:** WebGPU unavailable → no local mode, explain.
- **Auth:** None.
- **Dependencies:** FR-022.
- **Edge cases:** Integrated graphics; battery power.
- **Acceptance:** The recommendation changes with measured speed in tests using a mocked runtime.

### FR-025 — Company packs (consumption)
- **Phase:** P4 · **Priority:** Should `[DECIDED]`
- **Purpose:** Tailor sessions to a company using vetted public data.
- **User story:** As a candidate, I want questions that reflect the company's values and stack.
- **Inputs:** Selected company; pack file; profile; job description.
- **Outputs:** Condensed pack (target at most 1,500 tokens) injected as data into question generation and rubric criteria.
- **Business logic:** Packs hold sourced, dated, confidence-labeled fields (overview, products, stack evidence, values, documented process, culture signals). Each claim is `documented`, `inferred` or `unknown`. When no pack exists, the interviewer is told no verified company data exists and must not assert company facts.
- **Validation:** Pack schema, evidence URL and date required per field.
- **Errors:** Fetch failure → general session.
- **Auth:** None.
- **Dependencies:** FR-007, ADR-008.
- **Edge cases:** Stale pack; name collisions between companies; thin coverage.
- **Acceptance:** With a ready pack, at least some questions reference pack fields; without one, no question states company facts (checked by tests).

### FR-026 — Company research service (demand-gated)
- **Phase:** P5 · **Priority:** Should `[DECIDED]`
- **Purpose:** Build company packs once and share them with everyone, within a fixed budget.
- **User story:** As a candidate, I want the app to research my company if it is popular enough.
- **Inputs:** Company slug and optional domain hint from the client; no resume, job description or answers are ever sent.
- **Outputs:** Versioned pack stored in a database and mirrored to static files.
- **Business logic:** The project's own AI key is used only for this research, never for interviewing, and exists only on the server. Companies come from a pre-seeded list or become eligible after a demand threshold (starting value: 5 distinct clients within 14 days). A daily spend cap and per-job limits apply. A job queue deduplicates requests per company. Research sources are allowlisted, robots-aware and respect copyright (summaries and links only). No personal data about individuals is stored. No generic AI proxy endpoint exists.
- **Validation:** Company must resolve to a real domain; Turnstile and rate limits on request endpoints; server never fetches user-supplied URLs.
- **Errors:** Budget reached → "queued" state; insufficient public data → stored as such with a retry delay.
- **Auth:** None for users; server secrets for the pipeline.
- **Dependencies:** ADR-009, ADR-010, ADR-011.
- **Edge cases:** Spam requests; stored prompt injection from scraped pages; name collisions.
- **Acceptance:** Pipeline produces a schema-valid pack with evidence for each field; budget guard stops jobs at the cap in tests; no endpoint accepts arbitrary prompts.

### FR-027 — Calendar planning and Google Calendar
- **Phase:** P6 · **Priority:** Should `[DECIDED]`
- **Purpose:** Plan practice around real interview dates.
- **User story:** As a user, I want reminders and a prep plan before my interview.
- **Inputs:** Interview date, cadence, time zone.
- **Outputs:** `.ics` file first; later optional Google Calendar events and free-slot suggestions.
- **Business logic:** Preparation plan ramps difficulty toward the date and schedules a final mock. Google access uses the narrowest workable permission, client-side only, tokens kept in memory.
- **Validation:** Date in the future.
- **Errors:** OAuth denied → `.ics` fallback.
- **Auth:** Google consent (optional).
- **Dependencies:** ADR-012.
- **Edge cases:** App verification requirements by Google; users without Google accounts.
- **Acceptance:** `.ics` imports correctly into Google, Apple and Outlook calendars; OAuth path works in a test account.

### FR-028 — Spaced repetition of missed questions
- **Phase:** P6 · **Priority:** Could
- **Purpose:** Bring back weak questions at growing intervals.
- **User story:** As a user, I want missed questions to return until I answer them well.
- **Inputs:** Low-scoring turns.
- **Outputs:** Review queue and a daily review set.
- **Business logic:** Intervals grow after a good answer and reset after a poor one.
- **Validation:** None.
- **Errors:** None.
- **Auth:** None.
- **Dependencies:** FR-019.
- **Edge cases:** Large queues (cap daily items).
- **Acceptance:** Interval logic passes unit tests.

### FR-029 — Report incorrect company data
- **Phase:** P5 · **Priority:** Should
- **Purpose:** Let users flag wrong or outdated pack content.
- **User story:** As a user, I want to report a mistake in company information.
- **Inputs:** Pack field and reason.
- **Outputs:** A report record (server) or a prefilled issue link.
- **Business logic:** Reports lower a pack's confidence flag for review; no user identity is stored.
- **Validation:** Reason length limits; rate limit.
- **Errors:** Backend down → fall back to the issue link.
- **Auth:** None.
- **Dependencies:** FR-026.
- **Edge cases:** Abuse; duplicate reports.
- **Acceptance:** A report appears in the review queue and does not expose any user data.

### FR-030 — Settings and themes
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Central place for preferences.
- **User story:** As a user, I want light or dark mode and clear control over data.
- **Inputs:** Preferences.
- **Outputs:** Persisted settings.
- **Business logic:** Theme follows the system by default and can be overridden. Settings include providers, voice options, language, data tools, privacy summary and an about page with the license.
- **Validation:** None.
- **Errors:** None.
- **Auth:** None.
- **Dependencies:** FR-001.
- **Edge cases:** None.
- **Acceptance:** Preferences survive reload; both themes pass the accessibility checks in NFR-011.

### FR-031 — Installable app and offline shell
- **Phase:** P2 · **Priority:** Should
- **Purpose:** Make the app installable and resilient.
- **User story:** As a user, I want to open the app offline and install it.
- **Inputs:** Browser install prompt.
- **Outputs:** Installed web app; offline shell.
- **Business logic:** Cache the app shell; cloud-AI features show an offline state; local mode works offline once a model is cached.
- **Validation:** None.
- **Errors:** Service worker update conflicts → update prompt.
- **Auth:** None.
- **Dependencies:** FR-022.
- **Edge cases:** Stale caches after deploy.
- **Acceptance:** The app shell loads with no network after the first visit.

### FR-032 — Cost estimate and usage caps
- **Phase:** P1 · **Priority:** Must
- **Purpose:** Prevent surprise bills on the user's key.
- **User story:** As a user with a paid key, I want to know roughly what a session will cost.
- **Inputs:** Session plan, provider, model pricing (user-editable table).
- **Outputs:** Estimated token usage and cost range; running token counter.
- **Business logic:** Hard per-session token cap and per-turn output cap; warn before starting if the estimate is high.
- **Validation:** Caps are always on; users may raise them.
- **Errors:** Cap reached → graceful wrap-up.
- **Auth:** None.
- **Dependencies:** FR-005.
- **Edge cases:** Unknown pricing for custom endpoints (show tokens only).
- **Acceptance:** A runaway loop cannot exceed the cap (test with a mock provider).

### FR-033 — Public website and documentation pages
- **Phase:** P1 (PG-01 to PG-05, PG-08) · P2 (PG-07) · P3 (PG-06) · **Priority:** Must for P1 pages, Could for PG-07
- **Purpose:** Explain the product, build trust and support setup before a visitor enters the app.
- **User story:** As a visitor, I want to understand what this does and how my data is handled before I start.
- **Inputs:** Static content authored in the repository.
- **Outputs:** Prerendered static pages with titles, descriptions, social preview tags and a sitemap.
- **Business logic:** No third-party requests, cookies, analytics or tracking. Statements on the privacy page must match `docs/privacy-audit.md`. No invented statistics, testimonials, logos or model names; the "facts" shown are verifiable. The landing call to action leads to PG-09 (or to PG-14 for returning users, detected from local storage). Guides show a "last checked" date.
- **Validation:** Link checker and accessibility checks in CI; privacy page reviewed against the network allowlist at each release.
- **Errors:** Unknown routes show PG-08.
- **Auth:** None.
- **Dependencies:** `design.md` section 8, NFR-012, NFR-017, NFR-025, ADR-019, ADR-020.
- **Edge cases:** Provider terms and key-creation steps change (guides go stale); visitors on unsupported browsers; visitors with scripts disabled (pages still readable).
- **Acceptance:** All listed pages build as static HTML; no third-party request on any public page (automated network test); accessibility checks pass in both themes; titles and descriptions present; key guide shows its last-checked date.

---

## 5. Non-Functional Requirements

Numeric targets are initial values. Measure on real devices, then tune through a recorded change, never silently.

### Performance
| ID | Requirement |
| --- | --- |
| NFR-001 | Initial load: app shell interactive in 3 s or less on a mid-range laptop over a typical mobile connection. Initial JavaScript at most 300 KB gzipped; interview, charts, local-model and PDF code are lazy-loaded. |
| NFR-002 | UI stays responsive: input handled within 100 ms; no main-thread task over 50 ms on the interview screen. Heavy work (PDF parsing, local inference, statistics) runs in web workers. |
| NFR-003 | Interview latency (cloud AI): from answer submit to first streamed token within 2 s under normal provider conditions; first audio within 1 s of the first complete sentence. Provider slowness is shown, not hidden. |
| NFR-004 | Local inference never freezes the UI; token rate is visible; users can cancel generation at any time. |

### Security
| ID | Requirement |
| --- | --- |
| NFR-005 | Keys are never logged, placed in URLs, included in exports by default, or sent anywhere except the configured provider origin. Optional passphrase encryption at rest. |
| NFR-006 | Strict Content Security Policy; `connect-src` limited to an explicit allowlist that is documented and tested in CI. No third-party scripts except those documented (anti-abuse widget on request pages). Dependencies are pinned, audited in CI and free of GPL/AGPL licenses. All model and pack content is rendered as text, never as HTML. |
| NFR-007 | Backend: secrets only in server environment; input validation on every endpoint; rate limiting; SSRF protection (no user-supplied URLs fetched; private address ranges blocked); no endpoint that forwards arbitrary prompts to an AI model. |

### Scalability
| ID | Requirement |
| --- | --- |
| NFR-008 | The frontend is static and scales through a CDN. Company pack reads are cacheable and served from CDN or static files for at least 99% of requests. Research work is bounded by the daily budget, not by user count. |

### Reliability
| ID | Requirement |
| --- | --- |
| NFR-009 | No data loss on failure: each turn is saved when completed; a crashed or closed tab leaves a recoverable partial session. Every network dependency has a defined fallback (see AI-020). |
| NFR-010 | The app is fully usable when the backend is down (static pack mirror, general sessions). The backend is optional infrastructure, not a hard dependency. |

### Accessibility
| ID | Requirement |
| --- | --- |
| NFR-011 | WCAG 2.2 level AA: keyboard operation for every feature, screen reader labels, visible focus, sufficient contrast in both themes, text scaling to 200%, reduced-motion support, captions (subtitles) for all spoken content, no information conveyed by color alone. Voice is never the only way to do anything. |

### SEO
| ID | Requirement |
| --- | --- |
| NFR-012 | SEO applies only to the public pages PG-01 to PG-08: prerendered static HTML, semantic markup, titles, descriptions, social preview tags, sitemap, fast loading. The application pages (PG-09 onward) need no indexing. |

### Responsive behavior and compatibility
| ID | Requirement |
| --- | --- |
| NFR-013 | Layouts work from 360 px wide phones to large desktops; touch targets at least 44 px; no horizontal page scroll. |
| NFR-014 | Supported: latest two versions of Chrome, Edge, Firefox and Safari. Voice input needs a browser with speech recognition (Chrome and Edge desktop, Chrome on Android); other browsers get text mode. Local models need WebGPU (desktop Chrome or Edge). Unsupported features degrade with an explanation. |

### Maintainability
| ID | Requirement |
| --- | --- |
| NFR-015 | TypeScript strict mode; linting and formatting enforced in CI; business logic in a framework-free core package with at least 80% line coverage; architectural decisions recorded as ADRs; no dead code behind permanent flags. No dead code: unused files, exports, dependencies, styles, design tokens, font weights and commented-out code fail CI (`architecture.md` 24.6). |
| NFR-023 | Every provider, speech engine and storage layer is replaceable behind an interface and mockable in tests. Tests run without real API keys. |
| NFR-022 | Documentation: README quick start, key guide, troubleshooting, a privacy audit table listing every outbound network destination, and contributor guide. |

### Observability
| ID | Requirement |
| --- | --- |
| NFR-016 | Client: no remote telemetry. A local diagnostics panel shows redacted logs and capability checks that the user can copy into a bug report. Backend: structured logs, per-job cost and token metrics, daily spend dashboard, alerts at 50%, 80% and 100% of budget. |

### Privacy and data protection
| ID | Requirement |
| --- | --- |
| NFR-017 | No accounts, no analytics, no advertising or tracking scripts. The only project-server contact is a company name for research requests, plus static file fetches. An automated test fails the build if the app contacts an unlisted domain. Success metrics come from opt-in surveys and public signals. Fonts, scripts, images and styles are self-hosted: no runtime request goes to a font or content delivery network. |
| NFR-018 | Users can export and delete all local data. The backend stores no personal data: request counting uses an IP hash with a daily-rotating salt and a window of at most 14 days. Backup files exclude keys unless the user opts in. |

### Other
| ID | Requirement |
| --- | --- |
| NFR-019 | UI text is externalized for future translation. English only in v1; speech language is selectable. |
| NFR-020 | Interviewer content must not probe protected personal attributes (for example age, marital status, religion) and must stay professional. Tested with a fixed prompt suite. |
| NFR-021 | Licensing: code is MIT `[DECIDED]`. A third-party license file is maintained. Model licenses are shown in the model manager. |
| NFR-024 | Backend monthly cost has a documented hard cap enforced in code and at the provider. Frontend hosting uses free-tier static hosting. |
| NFR-025 | Typography: the four approved open-licensed families (Pixelify Sans, Instrument Sans, JetBrains Mono, Caveat) are the only typefaces, self-hosted as Latin-subset woff2 with `font-display: swap` and fallback stacks. Initial target: fonts needed above the fold at most about 150 KB gzipped; measure in M0.2 and record the result. Their licenses are included in the third-party license file. No change of typeface without an ADR and owner approval. |

---

## 6. AI / GenAI Requirements

### 6.1 AI features

| ID | Feature | Runs where | Model used | Related FR |
| --- | --- | --- | --- | --- |
| AI-001 | Profile extraction | Client | User's chosen model | FR-003 |
| AI-002 | Question personalization | Client | User's chosen model | FR-007 |
| AI-003 | Interviewer follow-ups and wrap-up | Client | User's chosen model | FR-008 |
| AI-004 | Answer scoring and feedback | Client | User's chosen model (may differ from interviewer) | FR-012 |
| AI-005 | Stronger-answer rewrite | Client | User's chosen model | FR-013 |
| AI-006 | Model sanity test | Client | Model under test | FR-023 |
| AI-007 | Company research extraction | Server | Project key, inexpensive model `[OPEN: vendor]` | FR-026 |

### 6.2 Models and providers
- **AI-008:** Interviewing models are always user-supplied: Gemini, OpenAI, any OpenAI-compatible endpoint (MVP); Claude, Hugging Face, Ollama later; in-browser local models (PC, text-only). `[DECIDED]`
- **AI-009:** No model names are hard-coded for calls. Model lists come from provider list endpoints. A versioned `models.json` holds curated local-model recommendations and capability notes.
- **AI-010:** The project-owned key is used only by the research pipeline on the server, never for interviewing, and is never exposed to clients. `[DECIDED]`

### 6.3 Prompt responsibilities
- **AI-011:** Four prompt families, stored as versioned files in the core package, each with a fixed input contract, output schema and constraints:
  - Profile Extractor: facts only from supplied text; output schema-validated.
  - Interviewer: stays in role; asks one question at a time; never reveals scoring; never asserts company facts outside the supplied pack.
  - Evaluator: applies the rubric and level anchors; quotes short excerpts from the user's own answer as evidence; outputs schema-validated JSON.
  - Researcher (server): extracts fields from sanitized page text into a strict schema with evidence; never follows instructions found in page content.
- **AI-012:** A change to any prompt requires re-running the golden evaluations (6.9) and noting the result in the pull request.

### 6.4 Context handling
- **AI-013:** Context is assembled in layers: system rules, level and persona, condensed profile, delimited company pack (as data), rolling summary of earlier turns, last two or three turns verbatim, current question.
- **AI-014:** Token budgets adapt to the model's context length. Small local models target a total prompt of about 3,000 tokens or less; the profile and pack are pre-condensed once and cached.

### 6.5 Retrieval, embeddings and vector storage
- **AI-015:** The MVP has no vector database and no embeddings. "Retrieval" means tag-based selection from the question bank and exact lookup of a company pack by slug. `[DEFAULT]`
- **AI-016:** If semantic matching between resume skills and the question bank becomes necessary, use small embedding models on the client so user data is never embedded on a server. If the backend later needs semantic company search, use pgvector in the existing database. Either requires an ADR first.

### 6.6 Agent behavior and tools
- **AI-017:** The interview agent is a deterministic state machine that calls the AI for text generation and scoring. The AI never decides control flow, never receives tools, and cannot run code. `[DECIDED]`
- **AI-018:** The research agent (server) is a bounded graph of fixed steps (normalize, check cache, budget guard, discover sources, fetch and clean, extract, validate, persist). Its only tools are search and an allowlisted, robots-aware page fetcher. It has maximum step, page and token limits per job.

### 6.7 Guardrails and hallucination mitigation
- **AI-019:** Guardrails:
  - Scraped or pasted text is treated as data inside delimiters, never as instructions; extraction output is schema-only, with length caps and hidden-text stripping.
  - Every AI output that drives behavior is schema-validated; invalid output is retried once, then handled by a defined fallback.
  - Interviewer content follows NFR-020.
  - User documents, transcripts and keys are never logged.
- **AI-021:** Hallucination mitigation:
  - Company facts come only from a pack field with evidence; otherwise the interviewer is instructed to state no company facts.
  - Question difficulty and skill tags come from the bank, not the model.
  - Scores must cite an excerpt from the user's answer.
  - Rewrites may use only facts in the profile; anything else is flagged "unsupported".
  - Pack fields carry `documented`, `inferred` or `unknown` labels and a retrieval date; `unknown` is allowed and preferred over guessing.
  - AI-generated questions outside the bank are labeled "unverified" and excluded from calibrated statistics.

### 6.8 Citations, streaming and cost
- **AI-022:** Citations: any company-derived content shown to the user lists its sources (link, title, retrieval date) in a "Company context used" panel on the session setup and results screens.
- **AI-023:** Streaming: interviewer text and scoring explanations stream token by token; subtitles follow the stream; generation is cancellable on pause, skip, end or navigation; partial output is discarded cleanly.
- **AI-024:** Cost control: condensed profile and pack are cached; per-session and per-turn token caps (FR-032); optionally a cheaper model for personalization and a stronger one for scoring; the backend enforces a daily and monthly spend cap with a per-job limit.

### 6.9 Fallbacks and quality evaluation
- **AI-020:** Fallback ladder (never leave the user stuck):
  1. Retry the failed call with backoff (up to 2 times).
  2. Re-ask for JSON or use prompt-based JSON when the provider lacks schema mode.
  3. Mark the turn `unscored` and continue.
  4. Use rule-based "basic feedback".
  5. Offer text mode when speech fails.
  6. Offer a general session when company data is missing.
  7. Save the partial session and explain.
  Backend research failure → serve the existing stale pack or a general session.
- **AI-025:** Evaluation assets live in the repository: a labeled scoring set (at least 20 transcripts per level band to start), a prompt-injection test set, an inappropriate-question test set, and a question-quality checklist. They run before each release using the owner's key; results are recorded under `docs/evals/`. Tests in CI use mocked providers only.

---

## 7. Legal, Licensing and Content Policy

- Code license: MIT `[DECIDED]`. The project name and logo are not licensed by MIT; a trademark note states that forks must rename.
- Model licenses are separate and the user's responsibility; the app displays them.
- Company research uses official or openly published sources, stores summaries with links (no verbatim copying), respects robots rules, and does not scrape sites whose terms forbid it (for example review and Q&A sites). No personal data about individuals is stored.
- License for the pack dataset itself `[OPEN]` (default proposal: a share-alike attribution license, separate from the MIT code).
- A lawyer reviews the privacy statement, pack licensing and scraping policy before the research service goes public.

## 8. External Dependencies

| Dependency | Use | Status |
| --- | --- | --- |
| AI providers (Gemini, OpenAI, OpenAI-compatible; later Claude, Hugging Face, Ollama) | Interviewing, user's own key | `[DECIDED]` |
| Browser APIs: IndexedDB, Web Speech, WebGPU, WebCrypto | Storage, voice, local models, key encryption | `[DEFAULT]` |
| Static hosting and CDN | Frontend and pack mirror | `[DEFAULT]` Cloudflare Pages |
| Managed Postgres | Research service | `[DEFAULT]` free-tier managed Postgres |
| Search API or provider grounding | Research discovery | `[OPEN]` |
| Anti-abuse widget | Request endpoints | `[DEFAULT]` Cloudflare Turnstile |
| Google OAuth | Optional calendar | `[DEFAULT]` |
| Typefaces: Pixelify Sans, Instrument Sans, JetBrains Mono, Caveat | Visual identity, self-hosted | `[DECIDED]` |

## 9. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Setup friction (no API key) | Users quit at step one | Free-key guide, local model path, presets, clear copy |
| Inconsistent AI scoring | Users distrust results | Fixed rubric, temperature 0, golden set, confidence display, "guidance not verdict" wording |
| Weak local models | Poor questions or scoring | Question bank does most work; "basic feedback" path; honest labels |
| Hallucinated company facts | Misleads users | Evidence-only packs, unknown allowed, source display |
| Stored prompt injection in packs | Harms all users | Schema-only extraction, delimiters, review of seed packs, report flow |
| Research budget abuse | Cost overrun | Demand gating, seeded list, caps, rate limits, kill switch |
| Browser storage loss | Lost history | Persistent storage request, export reminders, clear messaging |
| Browser speech sends audio to cloud | Privacy contradiction | Disclosure, later on-device speech |
| Solo maintainer overload | Project stalls | Strict scope, phases, issue policy |
| Crowded market | Low adoption | Differentiate on privacy, skill tracking, calibration, any-model support |

## 10. Assumptions
- Users can obtain a free-tier AI key or have a capable PC.
- Browser speech recognition is acceptable for the MVP with a disclosure.
- A hand-written question bank of useful size can be produced by the owner before Phase 2.
- Interview experience data from review sites will not be used.

## 11. Open Questions (do not guess; ask the owner)
1. Domain and handle availability for Abhyas, the trademark search, the mascot's name, and the final wordmark and logo.
2. Which AI vendor and model powers server-side company research.
3. Which search service (or provider grounding) is used for research.
4. [DECIDED] License for the pack dataset: Released under Open Data Commons Attribution License (ODC-By v1.0) and CC-BY-4.0 for factual extractions; trademarks remain property of respective companies (see docs/pack-data-license.md).
5. Hosting vendors for static site and API.
6. Size and authoring plan for the question bank (per skill and level).
7. Minimum device spec to officially support local mode.
8. Speech recognition choice for non-Chrome browsers.
9. [DECIDED] Threshold and cap values for company research after measuring cost per pack: Measured cost per pack is $0.0025 (0.25¢). Established caps: Daily budget $5.00 (500¢), Monthly budget $100.00 (10,000¢); Queue demand threshold: 5 distinct client-days; Per-job safety limits: max 10 pages, 50,000 tokens, 60s runtime, 10¢ cost; Pack TTL: 90 days (M5.6, Exit Gate G3).
10. Languages beyond English.
11. Whether the landing page gets an interactive demo (none exists; the design omits one).

## 12. Parking Lot (not approved; do not build)
Interactive landing-page demo; video and posture analysis; coding editor rounds; multilingual interviews; Whisper and voice activity detection; voice in local mode; mentor sharing links; Drive-based sync; hosted paid credits; Claude, Hugging Face and Ollama adapters beyond their scheduled phase; live-interview copilot (rejected); global leaderboards (rejected for privacy).

## 13. Glossary
- **BYOK:** bring your own key; the user supplies the AI credentials.
- **Level band:** the experience range used to calibrate difficulty and rubrics.
- **Pack:** a sourced, dated summary of public company information.
- **Turn:** one question with its answer, follow-ups and scores.
- **Basic feedback:** reduced scoring used with small local models.
- **Seeded company:** a company whose pack is prepared in advance by the owner.
- **Confidence:** how many scored answers support a skill number.

## 14. Change Log
| Date | Version | Change |
| --- | --- | --- |
| 2026-10-12 | 0.1.0 | Initial draft from planning decisions |
| 2026-10-13 | 0.2.0 | Added page and screen inventory (PG-01 to PG-23, section 3A), FR-033 (public website and docs), NFR-025 (typography and self-hosting), tightened NFR-012 and NFR-017, recorded the approved visual direction, updated open questions and parking lot |
| 2026-10-13 | 0.2.1 | Product named Abhyas (DryRun rejected after a conflict check); name-related open questions updated |
| 2026-10-13 | 0.2.2 | Added agent working agreements (no dead code, token economy, skills and tools) to section 0.4 and NFR-015 |
| 2026-10-19 | 0.7.4 | Completed Phase 5 (Company research service): resolved pack data license (ODC-By/CC-BY-4.0) and research budget caps from measured pack costs ($0.0025/pack); updated scraping policy and privacy audit |
| 2026-10-21 | 0.9.0 | Phase 7: approved and completed M7.1 Claude and Hugging Face provider adapters (FR-005) with network allowlist egress update and key safety verification |
| 2026-10-21 | 0.9.1 | M7.2: Custom local models (WebLLM & Ollama), safe format validation (ADR-017), hardware fit estimation, and sanity testing harness (FR-023, AI-006) |

