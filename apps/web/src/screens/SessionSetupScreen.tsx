// FR-006, FR-009, PG-11: Session setup screen (Step 3 of 3).
// Collects: interview type, session length, interviewer style, input mode (text or voice).
// Company selection is deferred to M4.3.
import { useEffect, useMemo, useState } from "react";
import {
  SessionPlanSchema,
  isPhoneDevice,
  type CompanyPack,
  type ExperienceLevel,
  type HardwareRuntime,
  type InputMode,
  type InterviewerStyle,
  type ProfileRow,
  type ProviderRow,
  type SessionLength,
  type SessionPlan,
  type SessionType,
  type SpeechInput,
  type StorageAdapter,
} from "@abhyas/core";
import { Button, Callout, RadioCard, Stepper } from "../components";
import { Dialog } from "../components/Dialog";
import { CompanyContextPanel } from "../components/CompanyContextPanel";
import { CompanyReportDialog } from "../components/CompanyReportDialog";
import {
  fetchCompanyDirectory,
  getCompanyDirectory,
  loadCompanyPack,
  searchCompanies,
  type CompanyDirectoryItem,
} from "../services/company-pack-service";
import { getBrowserSpeechInput } from "../services/speech";

interface SessionSetupScreenProps {
  storage: StorageAdapter;
  speechInput?: SpeechInput;
  onStart: (plan: SessionPlan) => void;
  onBack: () => void;
  onNavigateAISetup?: () => void;
  onNavigateSettings?: () => void;
  hardwareRuntime?: HardwareRuntime;
  initialCompanySlug?: string | null;
  apiUrl?: string;
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
  speechInput,
  onStart,
  onBack,
  onNavigateAISetup,
  onNavigateSettings,
  hardwareRuntime,
  initialCompanySlug,
  apiUrl,
}: SessionSetupScreenProps) {
  const [sessionType, setSessionType] = useState<SessionType>("mixed");
  const [length, setLength] = useState<SessionLength>(10);
  const [style, setStyle] = useState<InterviewerStyle>("standard");
  const [activeProviderKind, setActiveProviderKind] = useState<string | null>(null);

  const isMobile = useMemo(() => isPhoneDevice(hardwareRuntime), [hardwareRuntime]);
  const isLocalProvider = activeProviderKind === "webllm";

  const isSpeechSupported = useMemo(() => {
    // In local mode, never construct speech services (FR-022, ADR-013)
    if (isLocalProvider) return false;
    return speechInput ? speechInput.isSupported : getBrowserSpeechInput().isSupported;
  }, [speechInput, isLocalProvider]);

  const [inputMode, setInputMode] = useState<InputMode>("text");
  const effectiveInputMode: InputMode = isLocalProvider ? "text" : inputMode;

  // Profile-derived state
  const [level, setLevel] = useState<ExperienceLevel>("mid");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);

  // Company pack state (FR-025, ADR-008, M4.3)
  const [selectedCompanySlug, setSelectedCompanySlug] = useState<string | null>(
    initialCompanySlug ?? null
  );
  const [selectedPack, setSelectedPack] = useState<CompanyPack | null>(null);
  const [isCompanyStale, setIsCompanyStale] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isContextModalOpen, setIsContextModalOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [allCompanies, setAllCompanies] = useState<CompanyDirectoryItem[]>(() => getCompanyDirectory());

  // Fetch live or mirror directory on mount / search
  useEffect(() => {
    let mounted = true;
    fetchCompanyDirectory({ apiUrl, query: companySearch })
      .then((items) => {
        if (mounted && items.length > 0) {
          setAllCompanies(items);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [apiUrl, companySearch]);

  // Sync initialCompanySlug prop if it changes
  useEffect(() => {
    if (initialCompanySlug !== undefined) {
      setSelectedCompanySlug(initialCompanySlug);
    }
  }, [initialCompanySlug]);

  // Load company pack when selectedCompanySlug changes
  useEffect(() => {
    let mounted = true;
    if (!selectedCompanySlug) {
      setSelectedPack(null);
      setIsCompanyStale(false);
      return;
    }

    loadCompanyPack(selectedCompanySlug, storage).then((res) => {
      if (!mounted) return;
      if (res) {
        setSelectedPack(res.pack);
        setIsCompanyStale(res.isStale);
      } else {
        setSelectedPack(null);
        setIsCompanyStale(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [selectedCompanySlug, storage]);

  const matchingCompanies = useMemo(() => {
    return companySearch.trim() ? searchCompanies(companySearch) : allCompanies;
  }, [companySearch, allCompanies]);

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

        const providers = (await storage.getAll("providers")) as ProviderRow[];
        if (mounted) {
          setHasProvider(providers.length > 0);
          try {
            const activeSetting = await storage.get<{ key: string; value: string }>(
              "settings",
              "activeProviderId"
            );
            const activeId = activeSetting?.value ?? providers[0]?.id;
            const current = providers.find((p) => p.id === activeId) ?? providers[0] ?? null;
            setActiveProviderKind(current?.kind ?? null);
          } catch {
            setActiveProviderKind(providers[0]?.kind ?? null);
          }
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

    if (isMobile && isLocalProvider) {
      setValidationError(
        "Local mode is disabled on mobile devices (phones/tablets). Please configure a cloud AI provider."
      );
      return;
    }

    setIsStarting(true);
    try {
      const plan = SessionPlanSchema.parse({
        sessionId: crypto.randomUUID(),
        type: sessionType,
        length,
        style,
        inputMode: effectiveInputMode,
        level,
        targetRole,
        createdAt: new Date().toISOString(),
        isLocalModel: isLocalProvider,
        isSmallModel: isLocalProvider,
        companySlug: selectedPack?.slug,
        companyName: selectedPack?.name,
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

            {/* Input mode */}
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
                  checked={effectiveInputMode === "text"}
                  onChange={() => setInputMode("text")}
                />
                <RadioCard
                  title="Voice"
                  description={
                    isLocalProvider
                      ? "Voice is disabled in local mode to dedicate device resources to the model (FR-022, ADR-013)."
                      : isSpeechSupported
                        ? "Push-to-talk microphone input with live subtitles and review."
                        : "Voice input is not supported in this browser."
                  }
                  monogram="🎙"
                  tag={isLocalProvider ? "TEXT ONLY" : undefined}
                  checked={effectiveInputMode === "voice"}
                  onChange={() => {
                    if (!isLocalProvider && isSpeechSupported) setInputMode("voice");
                  }}
                  disabled={!isSpeechSupported || isLocalProvider}
                />
              </div>
              {isLocalProvider && (
                <div style={{ marginTop: "var(--space-2)" }}>
                  <Callout variant="info" title="Local Model: Text-Only Enforced">
                    Speech input and output are disabled in local mode (ADR-013). All device
                    resources are dedicated to the in-browser model.
                  </Callout>
                </div>
              )}
              {isMobile && isLocalProvider && (
                <div style={{ marginTop: "var(--space-2)" }}>
                  <Callout variant="danger" title="Local mode cannot run on phones">
                    Your configured AI provider is a local model, which is disabled on mobile
                    devices (phones/tablets). Please open AI Setup to configure a cloud provider
                    (Gemini or OpenAI) to practice on this device (FR-022, ADR-013).
                  </Callout>
                </div>
              )}
              {!isLocalProvider && !isSpeechSupported && (
                <p className="abh-form-hint" style={{ marginTop: "var(--space-2)" }}>
                  Voice input requires Chrome, Edge, or Safari speech recognition.
                </p>
              )}
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

            {/* Company field — M4.3 (FR-025, PG-11) */}
            <div className="abh-form-field">
              <label htmlFor="company-autocomplete-input" className="abh-label">
                Target Company (optional)
              </label>
              <p className="abh-form-hint" id="company-field-hint">
                Tailor questions to the employer&apos;s verified tech stack, values, and interview
                process (FR-025). Select a company or skip for a general session.
              </p>

              {selectedPack ? (
                <div className="abh-company-selected-box" data-testid="selected-company-box">
                  <div className="abh-company-selected-info">
                    <span className="abh-company-monogram" aria-hidden="true">
                      {selectedPack.slug.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <strong style={{ fontSize: "15px" }}>{selectedPack.name}</strong>
                        <span className="abh-company-domain">({selectedPack.domain})</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          marginTop: "var(--space-1)",
                        }}
                      >
                        {isCompanyStale ? (
                          <span
                            className="abh-badge abh-badge--warning"
                            data-testid="selected-company-stale"
                            style={{ fontSize: "10px" }}
                          >
                            STALE (TTL EXCEEDED)
                          </span>
                        ) : (
                          <span
                            className="abh-badge abh-badge--success"
                            data-testid="selected-company-verified"
                            style={{ fontSize: "10px" }}
                          >
                            VERIFIED ✓
                          </span>
                        )}
                        <span className="abh-company-date-tag">
                          Verified: {selectedPack.retrievedAt.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="abh-company-selected-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setIsContextModalOpen(true)}
                      data-testid="view-company-context-btn"
                    >
                      Company context used
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setSelectedCompanySlug(null);
                        setSelectedPack(null);
                      }}
                      data-testid="clear-company-btn"
                    >
                      Clear (general session)
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="abh-company-picker-wrapper">
                  <input
                    id="company-autocomplete-input"
                    type="text"
                    className="abh-input"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={isDropdownOpen}
                    aria-controls="company-autocomplete-list"
                    aria-describedby="company-field-hint"
                    placeholder="Search company (e.g. Google, Stripe, Amazon) or skip..."
                    value={companySearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                  />
                  {isDropdownOpen && (
                    <ul
                      id="company-autocomplete-list"
                      className="abh-company-autocomplete-dropdown"
                      role="listbox"
                    >
                      <li
                        className="abh-company-autocomplete-item abh-company-autocomplete-item--skip"
                        role="option"
                        aria-selected={false}
                        onClick={() => {
                          setSelectedCompanySlug(null);
                          setSelectedPack(null);
                          setIsDropdownOpen(false);
                          setCompanySearch("");
                        }}
                      >
                        <span>[Skip: general session]</span>
                        <span style={{ fontSize: "11px" }}>No company tailoring</span>
                      </li>
                      {matchingCompanies.map((c) => (
                        <li
                          key={c.slug}
                          className="abh-company-autocomplete-item"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setSelectedCompanySlug(c.slug);
                            setIsDropdownOpen(false);
                            setCompanySearch("");
                          }}
                        >
                          <div>
                            <strong>{c.name}</strong>{" "}
                            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                              ({c.domain})
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-1)" }}>
                            <span
                              className="abh-badge abh-badge--neutral"
                              style={{ fontSize: "10px" }}
                            >
                              {c.coverage.toUpperCase()}
                            </span>
                            {c.status === "requested" ? (
                              <span
                                className="abh-badge abh-badge--info"
                                data-testid="company-picker-status-requested"
                                style={{ fontSize: "10px" }}
                              >
                                REQUESTED ✓
                              </span>
                            ) : c.status === "queued" ? (
                              <span
                                className="abh-badge abh-badge--warning"
                                data-testid="company-picker-status-queued"
                                style={{ fontSize: "10px" }}
                              >
                                QUEUED
                              </span>
                            ) : c.status === "researching" ? (
                              <span
                                className="abh-badge abh-badge--accent"
                                data-testid="company-picker-status-researching"
                                style={{ fontSize: "10px" }}
                              >
                                RESEARCHING
                              </span>
                            ) : c.status === "insufficient_data" ? (
                              <span
                                className="abh-badge abh-badge--neutral"
                                data-testid="company-picker-status-insufficient"
                                style={{ fontSize: "10px" }}
                              >
                                INSUFFICIENT
                              </span>
                            ) : c.isStale ? (
                              <span
                                className="abh-badge abh-badge--warning"
                                data-testid="company-picker-status-stale"
                                style={{ fontSize: "10px" }}
                              >
                                STALE
                              </span>
                            ) : (
                              <span
                                className="abh-badge abh-badge--success"
                                data-testid="company-picker-status-ready"
                                style={{ fontSize: "10px" }}
                              >
                                READY ✓
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                      {companySearch.trim().length >= 2 && (
                        <li
                          className="abh-company-autocomplete-item abh-company-autocomplete-item--request"
                          role="option"
                          aria-selected={false}
                          data-testid="request-company-picker-btn"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setIsRequestDialogOpen(true);
                          }}
                        >
                          <div style={{ color: "var(--accent)" }}>
                            <strong>+ Request pack for &quot;{companySearch.trim()}&quot;</strong>
                          </div>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            Demand-gated research (no personal data)
                          </span>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
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
                disabled={hasProvider === false || (isMobile && isLocalProvider)}
              >
                Start Session
              </Button>
            </div>
          </section>
        </div>
      </main>

      {/* Company context used Dialog (PG-11, FR-025) */}
      {selectedPack && (
        <Dialog
          isOpen={isContextModalOpen}
          onClose={() => setIsContextModalOpen(false)}
          title={`Company Context: ${selectedPack.name}`}
        >
          <CompanyContextPanel
            pack={selectedPack}
            isStale={isCompanyStale}
            onClose={() => setIsContextModalOpen(false)}
          />
        </Dialog>
      )}

      {/* Company pack research request Dialog (PG-21, FR-026) */}
      <CompanyReportDialog
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        initialMode="request"
        storage={storage}
        apiUrl={apiUrl}
        company={
          companySearch.trim()
            ? {
                name: companySearch.trim(),
                slug: companySearch
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-"),
                domain: "",
              }
            : undefined
        }
      />
    </div>
  );
}
