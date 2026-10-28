// FR-033, design.md section 8: PG-07 Roadmap and Changelog.
// "Phases in plain words, current status, release notes. No dates promised."
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

interface PhaseItem {
  id: string;
  name: string;
  status: "Completed" | "Current" | "Planned";
  badgeClass: string;
  summary: string;
  highlights: string[];
}

const PHASES: PhaseItem[] = [
  {
    id: "Phase 0",
    name: "Foundations & Safe Architecture",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Core contracts, offline-first storage engine, design tokens for Ink and Paper themes, self-hosted fonts, and zero-telemetry boundary enforcement.",
    highlights: [
      "Strict type safety and boundary checking",
      "Ink and Paper high-contrast WCAG 2.2 AA themes",
      "Dexie IndexedDB storage engine with validation and quarantine",
      "Network egress allowlist and automated license audit",
    ],
  },
  {
    id: "Phase 1",
    name: "Core Interview Loop & Public Launch",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Full voice and text interview practice with push-to-talk, real-time transcription, schema-constrained evaluation, grounded rewrites, and public documentation.",
    highlights: [
      "Multi-provider direct client adapters (Gemini & OpenAI-compatible)",
      "Client-side document parsing in Web Worker (PDF, DOCX, TXT) with 0 network calls",
      "Live interview focus screen with timer, subtitles, hint, and follow-up loops",
      "Grounded rewrite generator with anti-hallucination verification",
      "Prerendered static public pages with zero external scripts",
    ],
  },
  {
    id: "Phase 2",
    name: "Skills Dashboard & Habit Engine",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Honest skill statistics, level-calibrated difficulty, practice drills targeting calibrated weak points, daily streaks, and PWA offline installation.",
    highlights: [
      "15-skill taxonomy across technical, behavioral, and delivery categories",
      "Recency-weighted scoring engine (H=8 half-life) with confidence tracking",
      "Interactive skills dashboard with score bands and chronological sparklines",
      "Quick-fire and Deep-dive targeted skill drills with 'Fix my weakest' 1-click CTA",
      "Offline Service Worker shell pre-caching and installable Web App Manifest",
    ],
  },
  {
    id: "Phase 3",
    name: "In-Browser & Local Models",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "100% offline, zero-network-egress practice powered by WebGPU in-browser models (WebLLM) and local daemon servers (Ollama, LM Studio).",
    highlights: [
      "Device capability detection (RAM, WebGPU, token decoding micro-benchmark)",
      "Strict device stability rules: PC desktop only, text-only enforcement",
      "Curated local models catalog with automated post-load sanity testing",
      "Local server setup support with classified CORS diagnostic helpers",
      "Prominent honesty badge tagging for basic model feedback",
    ],
  },
  {
    id: "Phase 4",
    name: "Curated Company Context Packs",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Tailor practice sessions with evidenced company context packs covering values, culture, technical stack, and verified interview formats.",
    highlights: [
      "Evidenced pack contract requiring verified citations, dates, and official sources",
      "12 hand-reviewed seed packs for popular tech employers",
      "Pack-aware prompt layering with values weighting and anti-hallucination guards",
      "Multi-layer prompt injection defense and delimiter neutralization",
      "Company directory and detail browser with offline IndexedDB caching",
    ],
  },
  {
    id: "Phase 5",
    name: "Demand-Gated Research Service",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Bounded research pipeline to ingest and curate new company packs safely when real user demand passes community thresholds.",
    highlights: [
      "FastAPI service with strict rate limiting and anonymous client hashing",
      "SSRF-safe fetcher blocking private, loopback, and cloud metadata addresses",
      "Hard budget caps ($5/day, $100/month) and automated operator kill switch",
      "Static mirror export fallback for 100% offline resilience",
    ],
  },
  {
    id: "Phase 6",
    name: "Preparation Schedule & Spaced Review",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Long-term interview preparation planning with universal .ics calendar integration, ramping difficulty plans, and spaced repetition review.",
    highlights: [
      "Cadence and target date schedule generation with progressive difficulty ramping",
      "RFC 5545 universal .ics export compatible with Google, Apple, and Outlook",
      "Client-side Google Calendar integration with in-memory tokens only",
      "Spaced repetition review queue with expanding intervals (1d to 60d) and 10/day cap",
      "Automatic enqueuing of weak interview turns into review queue",
    ],
  },
  {
    id: "Phase 7",
    name: "Advanced Providers & On-Device Speech",
    status: "Completed",
    badgeClass: "abh-status-completed",
    summary:
      "Additional BYOK providers, custom local model imports, and local voice activity detection (VAD) for natural hands-free conversation.",
    highlights: [
      "Anthropic Claude (Messages API) and Hugging Face serverless provider adapters",
      "Custom local model support with safe file format checks (.safetensors, .gguf, .onnx)",
      "Web Audio API Voice Activity Detection (VAD) for automatic silence detection",
      "Expanded 60-question bank with level-calibrated follow-ups and rubric hints",
    ],
  },
];

interface ReleaseNote {
  version: string;
  title: string;
  summary: string;
  changes: string[];
}

const RELEASES: ReleaseNote[] = [
  {
    version: "v0.9.3",
    title: "Phase 7 Complete: Advanced Multi-Provider & Hands-Free VAD",
    summary:
      "Added Anthropic Claude and Hugging Face inference support, custom local model validation, on-device voice activity detection, and comprehensive exit gate verification.",
    changes: [
      "BYOK direct browser adapter for Anthropic Claude (Messages API) and Hugging Face serverless API",
      "Custom local model loading with safety format verification blocking unsafe pickle formats",
      "Real-time Web Audio API voice activity detection (VAD) with configurable silence countdown",
      "60-question calibrated bank across all 5 experience level bands",
    ],
  },
  {
    version: "v0.8.2",
    title: "Phase 6 Complete: Schedule Generation & Spaced Repetition",
    summary:
      "Introduced prep plans with RFC 5545 .ics calendar export, optional Google Calendar sync, and a daily spaced repetition review queue.",
    changes: [
      "Universal .ics calendar generator with 75-octet line folding and strict CRLF formatting",
      "Spaced repetition review queue with expanding intervals (1d, 3d, 7d, 14d, 30d, 60d) and 10/day cap",
      "Automatic weak turn capture from session scorecard into review queue",
      "In-memory Google Calendar event creation with zero persistent credentials",
    ],
  },
  {
    version: "v0.7.6",
    title: "Phase 5 Complete: Demand-Gated Company Research Service",
    summary:
      "Launched bounded backend research service with SSRF protection, strict budget caps, and static pack mirror export.",
    changes: [
      "FastAPI research service in apps/api with SQLite/PostgreSQL async support",
      "SSRF-safe web fetcher blocking cloud metadata (169.254.169.254) and private networks",
      "Enforced $5/day and $100/month budget caps with emergency kill-switch",
      "Static pack mirror fallback guaranteeing client offline independence",
    ],
  },
  {
    version: "v0.6.5",
    title: "Phase 4 Complete: Evidenced Company Context Packs",
    summary:
      "Added company-tailored interview practice with 12 seed company packs, prompt injection safety defenses, and company directory.",
    changes: [
      "Evidenced company pack contract requiring verified citations and dates",
      "12 curated seed packs for major employers (Google, Amazon, Meta, Apple, etc.)",
      "Values-weighted question selection and company tech stack tailoring",
      "Prompt injection defense with untrusted input sanitization and delimiter neutralization",
    ],
  },
  {
    version: "v0.5.6",
    title: "Phase 3 Complete: Offline & Local Models Engine",
    summary:
      "Introduced private offline practice with in-browser WebGPU models and local server adapters (Ollama, LM Studio).",
    changes: [
      "WebGPU hardware capability benchmark and token decoding throughput speed test",
      "In-browser model runner in Web Worker with WebLLM integration",
      "Ollama adapter with NDJSON streaming and automated localhost CORS diagnosis",
      "PC-only and text-only device safety enforcement with 'Basic Feedback' honesty badges",
    ],
  },
  {
    version: "v0.4.6",
    title: "Phase 2 Complete: Skills Dashboard, Habit & PWA Shell",
    summary:
      "Delivered honest skill analytics, category-grouped practice drills, daily streaks with guilt-free rest days, and offline PWA support.",
    changes: [
      "15-skill taxonomy engine with recency-weighted statistics and confidence scores",
      "Interactive skills dashboard with horizontal bars and score history sparklines",
      "Quick-fire (5 Qs) and Deep-dive (10 Qs) drills with 'Fix my weakest' 1-click CTA",
      "Deterministic local habit engine with protective monthly freezes",
      "Installable PWA manifest and offline service worker shell",
    ],
  },
  {
    version: "v0.3.8",
    title: "Phase 1 Complete: Voice & Text Practice Core Loop",
    summary:
      "Launched complete client-side interview practice flow with AI adapters, speech recognition, rubric evaluation, and public site.",
    changes: [
      "Gemini and OpenAI browser adapters with PBKDF2/AES-GCM client encryption",
      "Client-side document parsing in Web Worker for PDF, DOCX, and TXT",
      "Push-to-talk voice interview with live subtitle lanes and transcript review",
      "Rubric-based evaluation with anti-hallucination grounded rewrites",
      "Prerendered static public pages with zero third-party network egress",
    ],
  },
];

export function RoadmapPage() {
  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/roadmap" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">&#123; Product Progress &amp; Changelog &#125;</span>
            <h1 className="abh-content-title">
              ROADMAP &amp; RELEASE NOTES
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <p className="abh-content-subtitle">
              Phases in plain words, current development status, and detailed release notes. No
              dates promised — every capability is built and verified with honest criteria.
            </p>
          </header>

          {/* Development Principles Banner */}
          <div
            className="abh-code-box"
            style={{ position: "static", margin: "32px 0", maxWidth: "800px" }}
          >
            &gt; PHILOSOPHY:
            <br />
            &gt; We ship working software with verifiable guarantees, zero tracking, and no lock-in.
            <br />
            &gt; Every phase has an explicit exit gate, automated accessibility tests, and zero dead
            code.
          </div>

          {/* Section 1: Roadmap by Phase */}
          <section className="abh-content-section" aria-labelledby="roadmap-heading">
            <h2 id="roadmap-heading" className="abh-content-h2">
              1. Roadmap by Phase
            </h2>
            <p className="abh-prose">
              Abhyas is developed in structured phases, each building upon verified contracts and
              rigorous client-side privacy architecture.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                marginTop: "24px",
              }}
            >
              {PHASES.map((phase) => (
                <article
                  key={phase.id}
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {phase.id}
                      </span>
                      <h3
                        style={{
                          margin: "4px 0 0",
                          fontSize: "18px",
                          fontWeight: 700,
                          color: "var(--text-normal)",
                        }}
                      >
                        {phase.name}
                      </h3>
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor:
                          phase.status === "Completed"
                            ? "var(--badge-success-bg, rgba(34, 197, 94, 0.15))"
                            : "var(--badge-neutral-bg, rgba(255, 255, 255, 0.1))",
                        color:
                          phase.status === "Completed"
                            ? "var(--badge-success-text, #4ade80)"
                            : "var(--text-normal)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      ✓ {phase.status}
                    </span>
                  </div>

                  <p className="abh-prose" style={{ margin: "0 0 16px" }}>
                    {phase.summary}
                  </p>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "var(--text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    {phase.highlights.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* Section 2: Release Notes & Changelog */}
          <section
            className="abh-content-section"
            aria-labelledby="changelog-heading"
            style={{ marginTop: "48px" }}
          >
            <h2 id="changelog-heading" className="abh-content-h2">
              2. Changelog &amp; Release History
            </h2>
            <p className="abh-prose">
              All architectural and user-facing changes recorded in progression order.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                marginTop: "24px",
              }}
            >
              {RELEASES.map((rel) => (
                <article
                  key={rel.version}
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      flexWrap: "wrap",
                      gap: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "18px",
                        fontWeight: 700,
                        color: "var(--text-normal)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-text)",
                          marginRight: "8px",
                        }}
                      >
                        {rel.version}
                      </span>
                      — {rel.title}
                    </h3>
                  </div>

                  <p className="abh-prose" style={{ margin: "0 0 14px" }}>
                    {rel.summary}
                  </p>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      color: "var(--text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    {rel.changes.map((change, cIdx) => (
                      <li key={cIdx}>{change}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
