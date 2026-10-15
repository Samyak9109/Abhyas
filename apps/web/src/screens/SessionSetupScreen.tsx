// FR-006, PG-11: Session setup screen (Step 3 of 3).
// Collects: interview type, session length, interviewer style, input mode.
// Voice is gated (disabled) — actual voice implementation is M1.6.
// Company selection is deferred to M4.3.
import { useEffect, useState } from "react";
import {
  SessionPlanSchema,
  type ExperienceLevel,
  type InputMode,
  type InterviewerStyle,
  type ProfileRow,
  type SessionLength,
  type SessionPlan,
  type SessionType,
  type StorageAdapter,
} from "@abhyas/core";
import { Button, Callout, RadioCard, Stepper } from "../components";

interface SessionSetupScreenProps {
  storage: StorageAdapter;
  onStart: (plan: SessionPlan) => void;
  onBack: () => void;
  onNavigateAISetup?: () => void;
  onNavigateSettings?: () => void;
}

const SETUP_STEPS = [
  { id: "ai", label: "AI Setup" },
  { id: "profile", label: "Profile" },
  { id: "session", label: "Session" },
];

// --- Static option lists ---------------------------------------------------

const SESSION_TYPES: {
  id: SessionType;
  label: string;
  monogram: string;
  description: string;
}[] = [
  {
    id: "behavioral",
    label: "HR / Behavioral",
    monogram: "HR",
    description: "Situation-based questions probing ownership, conflict, and leadership stories",
  },
  {
    id: "technical",
    label: "Technical",
    monogram: "TE",
    description: "Code quality, architecture decisions, and engineering best-practice questions",
  },
  {
    id: "system_design",
    label: "System Design",
    monogram: "SD",
    description: "Design large-scale distributed systems from scratch under constraints",
  },
  {
    id: "dsa_verbal",
    label: "DSA Verbal",
    monogram: "DS",
    description: "Algorithms and data structures explained verbally — no live coding",
  },
  {
    id: "mixed",
    label: "Mixed",
    monogram: "MX",
    description: "A balanced blend of all question types for a realistic full-loop simulation",
  },
];

const SESSION_LENGTHS: { value: SessionLength; label: string; description: string }[] = [
  { value: 5, label: "5 questions", description: "~15 min — quick warm-up" },
  { value: 10, label: "10 questions", description: "~30 min — standard practice" },
  { value: 15, label: "15 questions", description: "~45 min — deep session" },
];

const STYLES: {
  id: InterviewerStyle;
  label: string;
  monogram: string;
  description: string;
}[] = [
  {
    id: "friendly",
    label: "Friendly",
    monogram: "😊",
    description: "Supportive tone, hints offered, encouragement on partial answers",
  },
  {
    id: "standard",
    label: "Standard",
    monogram: "🎯",
    description: "Professional and neutral — closest to a typical industry interview",
  },
  {
    id: "strict",
    label: "Strict",
    monogram: "⚡",
    description: "Minimal encouragement, probing follow-ups, high pressure simulation",
  },
];

// ---------------------------------------------------------------------------

function levelDefaultDifficulty(level: ExperienceLevel): string {
  const map: Record<ExperienceLevel, string> = {
    intern_fresher: "Difficulty 1–2 (foundational)",
    junior: "Difficulty 1–3 (foundational to intermediate)",
    mid: "Difficulty 2–4 (intermediate)",
    senior: "Difficulty 3–5 (advanced)",
    staff_plus: "Difficulty 4–5 (expert)",
  };
  return map[level] ?? "Difficulty calibrated to your level";
}

function levelLabel(level: ExperienceLevel): string {
  const map: Record<ExperienceLevel, string> = {
    intern_fresher: "Intern / Fresher",
    junior: "Junior (1–3 yrs)",
    mid: "Mid-level (3–5 yrs)",
    senior: "Senior (5–8 yrs)",
    staff_plus: "Staff+ (8+ yrs)",
  };
  return map[level] ?? level;
}

// ---------------------------------------------------------------------------

export function SessionSetupScreen({
  storage,
  onStart,
  onBack,
  onNavigateAISetup,
  onNavigateSettings,
}: SessionSetupScreenProps) {
  const [sessionType, setSessionType] = useState<SessionType>("mixed");
  const [length, setLength] = useState<SessionLength>(10);
  const [style, setStyle] = useState<InterviewerStyle>("standard");
  const [inputMode] = useState<InputMode>("text"); // voice is M1.6 — gated

  // Profile-derived state
  const [level, setLevel] = useState<ExperienceLevel>("mid");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // --- Load profile and provider on mount ----------------------------------

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const profiles = await storage.getAll<ProfileRow>("profile");
        if (mounted && profiles.length > 0) {
          const p = profiles[0]!;
          if (p.level) setLevel(p.level as ExperienceLevel);
          if (p.targetRole) setTargetRole(p.targetRole);
        }

        const providers = await storage.getAll("providers");
        if (mounted) {
          setHasProvider(providers.length > 0);
        }
      } catch {
        // Fallback to defaults — profile screen validates before reaching here.
        if (mounted) setHasProvider(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [storage]);

  // --- Start session --------------------------------------------------------

  const handleStart = async () => {
    setValidationError(null);

    if (!hasProvider) {
      setValidationError("No AI provider configured. Please complete AI Setup first.");
      return;
    }

    setIsStarting(true);
    try {
      const plan = SessionPlanSchema.parse({
        sessionId: crypto.randomUUID(),
        type: sessionType,
        length,
        style,
        inputMode,
        level,
        targetRole,
        createdAt: new Date().toISOString(),
      });
      onStart(plan);
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error
          ? err.message
          : "Invalid session configuration. Please check your selections."
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="abh-setup-page">
      <header className="abh-setup-header">
        <div className="abh-setup-header-inner">
          <span className="abh-wordmark">Abhyas</span>
          <Stepper steps={SETUP_STEPS} currentStepIndex={2} />
          {onNavigateSettings && (
            <Button variant="ghost" onClick={onNavigateSettings}>
              Settings
            </Button>
          )}
        </div>
      </header>

      <main className="abh-setup-main">
        <div className="abh-setup-grid">
          {/* Left column: type + length */}
          <section className="abh-setup-col-left" aria-labelledby="session-type-heading">
            <span className="abh-step-badge">Step 3 of 3</span>
            <h1 className="abh-setup-title">Set Up Your Session</h1>
            <p className="abh-setup-intro">
              Choose what you want to practice. Questions are calibrated to your{" "}
              <strong>{levelLabel(level)}</strong> profile for the role of{" "}
              <strong>{targetRole}</strong>.
            </p>

            {/* Interview type */}
            <div className="abh-form-field">
              <h2 id="session-type-heading" className="abh-section-heading">
                Interview Type
              </h2>
              <p className="abh-form-hint">Select the type of interview you want to simulate.</p>
              <div
                className="abh-level-radio-group"
                role="radiogroup"
                aria-labelledby="session-type-heading"
              >
                {SESSION_TYPES.map((t) => (
                  <RadioCard
                    key={t.id}
                    title={t.label}
                    description={t.description}
                    monogram={t.monogram}
                    checked={sessionType === t.id}
                    onChange={() => setSessionType(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* Session length */}
            <div className="abh-form-field">
              <h2 id="session-length-heading" className="abh-section-heading">
                Session Length
              </h2>
              <div
                className="abh-level-radio-group"
                role="radiogroup"
                aria-labelledby="session-length-heading"
              >
                {SESSION_LENGTHS.map((l) => (
                  <RadioCard
                    key={l.value}
                    title={l.label}
                    description={l.description}
                    monogram={String(l.value)}
                    checked={length === l.value}
                    onChange={() => setLength(l.value)}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Right column: style + mode + summary + CTA */}
          <section className="abh-setup-col-right" aria-labelledby="interviewer-style-heading">
            {/* Interviewer style */}
            <div className="abh-form-field">
              <h2 id="interviewer-style-heading" className="abh-section-heading">
                Interviewer Style
              </h2>
              <p className="abh-form-hint">
                Controls follow-up intensity and tone throughout the session.
              </p>
              <div
                className="abh-level-radio-group"
                role="radiogroup"
                aria-labelledby="interviewer-style-heading"
              >
                {STYLES.map((s) => (
                  <RadioCard
                    key={s.id}
                    title={s.label}
                    description={s.description}
                    monogram={s.monogram}
                    checked={style === s.id}
                    onChange={() => setStyle(s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Input mode — voice gated for M1.6 */}
            <div className="abh-form-field">
              <h2 id="input-mode-heading" className="abh-section-heading">
                Input Mode
              </h2>
              <p className="abh-form-hint">How you will answer questions during the session.</p>
              <div
                className="abh-level-radio-group"
                role="radiogroup"
                aria-labelledby="input-mode-heading"
              >
                <RadioCard
                  title="Text"
                  description="Type your answers. Works on any device and browser."
                  monogram="T"
                  checked={inputMode === "text"}
                  onChange={() => {
                    /* text is the only available mode */
                  }}
                />
                <RadioCard
                  title="Voice"
                  description="Push-to-talk microphone input with speech recognition."
                  monogram="🎙"
                  checked={false}
                  onChange={() => {
                    /* voice is M1.6 */
                  }}
                  disabled
                  comingSoon
                />
              </div>
            </div>

            {/* Difficulty info callout */}
            <Callout variant="info" title="Difficulty calibration">
              {levelDefaultDifficulty(level)} — questions are drawn from the curated bank for your
              experience level. AI personalizes phrasing only; it never adjusts difficulty.
            </Callout>

            {/* Missing provider warning */}
            {hasProvider === false && (
              <Callout variant="warning" title="AI provider not configured">
                A provider is required to start a session.{" "}
                {onNavigateAISetup ? (
                  <button type="button" className="abh-inline-link" onClick={onNavigateAISetup}>
                    Go to AI Setup
                  </button>
                ) : (
                  "Please complete AI Setup first."
                )}
              </Callout>
            )}

            {/* Company field — deferred to M4.3 */}
            <div className="abh-form-field">
              <p className="abh-form-hint" aria-label="Company-specific question packs">
                <strong>Company packs</strong> — targeted company question packs are coming in a
                future release.
              </p>
            </div>

            {/* Validation error */}
            {validationError && (
              <Callout variant="danger" title="Cannot start session">
                {validationError}
              </Callout>
            )}

            {/* Navigation */}
            <div className="abh-setup-actions">
              <Button type="button" variant="secondary" onClick={onBack}>
                Back to Profile
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStart}
                isLoading={isStarting}
                disabled={hasProvider === false}
              >
                Start Session
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
