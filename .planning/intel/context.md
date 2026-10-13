# Synthesized Context & Background — Abhyas

## Topic: Product Identity & Core Vision
- source: PRD.md
- content: Abhyas (अभ्यास: Hindi/Sanskrit for "practice") is an open-source, private, local-first web application designed to solve the critical shortage of realistic interview practice for students and early-career candidates. Candidates practice out loud or via text with an AI interviewer calibrated to their resume, job description, experience level, and target company, receiving structured, rubric-based feedback and actionable answer improvements.

## Topic: Target Personas
- source: PRD.md
- content:
  - **P-A (Aarav, Campus Placement Candidate):** Final-year student preparing for high-stakes placement drives. Needs fast start, voice practice, structure coaching (STAR method), and free model access.
  - **P-B (Priya, Early-Career Role Switcher):** Software engineer with 2 years experience transitioning to a senior product engineering role. Needs deeper technical questioning, resume grounding checks, and skill deficit tracking over time.
  - **P-C (Vikram, Privacy-Conscious / Local AI Developer):** Senior developer who refuses to upload personal data or resumes to third-party clouds. Relies on WebGPU local models and Ollama integration.

## Topic: Brand & Visual Direction
- source: design.md
- content: Approved retro-pixel aesthetic featuring a dark "Ink" background (near-black) contrasted with warm cream "Paper" elements, a vibrant orange accent, pixel display headers (Pixelify Sans), monospaced technical labels (JetBrains Mono), clean body text (Instrument Sans), and occasional editorial margin annotations (Caveat). The interviewer is embodied by a pixel monitor-head mascot.

## Topic: Phased Delivery Roadmap & Validation Gates
- source: phases.md
- content:
  - **P0: Foundations (Infrastructure, core contracts, design tokens, self-hosted fonts, CI/CD, compliance)**
  - **P1: MVP Core Loop & Public Site (Setup, profile, FSM interview runner, voice Web Speech, rubric evaluation, results, public static site; Gate G1 user validation)**
  - **P2: Skills & Calibration (Taxonomy, confidence stats, single-skill drills, habit tracking, data import)**
  - **P3: Local Text Mode (WebGPU WebLLM engine, local Ollama adapter, offline text sessions)**
  - **P4: Company Packs (Curated static JSON packs, schema validation, static mirror)**
  - **P5: Research Service (Optional FastAPI + Postgres backend, LangGraph research graph, budget caps)**
  - **P6: Calendar & Preparation Planning (.ics export, optional Google OAuth)**
  - **P7: Advanced Features (Custom community packs, on-device Whisper speech)**

## Topic: Authority & Governance
- source: AGENTS.md
- content: The project's single source of truth follows the strict precedence hierarchy: `PRD.md` > `architecture.md` > `design.md` > `phases.md` > existing code. AI coding agents and human contributors adhere to strict non-negotiables: absolute privacy, self-hosted fonts, token-only styling, runtime schema validation, and zero dead code.
