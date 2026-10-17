// FR-016, design.md 8 & 9 (PG-16): Skill-wise practice screen.
// Enables drilling one skill at a time with Quick-fire or Deep-dive formats,
// "Fix my weakest" recommendation, bank question availability badges,
// and graceful handling of missing bank questions.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { DEFAULT_QUESTION_BANK } from "../services/question-bank";
import {
  getBankSkillStats,
  getBenchmarkForLevel,
  getScoreBand,
  getScoreBandLabel,
  LEVEL_BANDS,
  selectDrillQuestions,
  selectWeakestSkill,
  SessionPlanSchema,
  type ExperienceLevel,
  type DrillFormat,
  type InputMode,
  type Profile,
  type SelectedQuestion,
  type SessionPlan,
  type SessionRow,
  type SkillCategory,
  type SkillStatRow,
  type StorageAdapter,
  type StructuredProfile,
  type TurnRow,
} from "@abhyas/core";
import { CANONICAL_SKILLS, getSkillDefinition } from "@abhyas/content";
import { Button, Callout, Skeleton } from "../components";
import { recomputeAndStoreSkillStats } from "../services/skills-recompute";

interface SkillPracticeScreenProps {
  storage: StorageAdapter;
  initialSkillId?: string | null;
  onStartDrill: (plan: SessionPlan, questions: SelectedQuestion[]) => void;
  onStartSession?: () => void;
  onNavigateSkills?: () => void;
  onNavigateHome?: () => void;
}

interface CategoryInfo {
  label: string;
  icon: string;
  tokenVar: string;
  description: string;
}

const CATEGORY_META: Record<SkillCategory, CategoryInfo> = {
  technical: {
    label: "Technical Skills",
    icon: "⚙️",
    tokenVar: "var(--cat-technical)",
    description:
      "Core algorithms, distributed architecture, database schemas, and web fundamentals.",
  },
  behavioral: {
    label: "Behavioral Skills",
    icon: "🤝",
    tokenVar: "var(--cat-behavioral)",
    description:
      "Structured communication, ownership, constructive conflict, and technical leadership.",
  },
  delivery: {
    label: "Delivery Skills",
    icon: "🎙️",
    tokenVar: "var(--cat-delivery)",
    description: "Verbal clarity, pacing, and filler word control during voice sessions.",
  },
};

function mapSkillToType(
  category: SkillCategory,
  skillId: string
): "dsa_verbal" | "system_design" | "behavioral" | "technical" {
  if (skillId === "dsa") return "dsa_verbal";
  if (skillId === "system_design") return "system_design";
  if (category === "behavioral") return "behavioral";
  return "technical";
}

export function SkillPracticeScreen({
  storage,
  initialSkillId,
  onStartDrill,
  onStartSession,
  onNavigateSkills,
  onNavigateHome,
}: SkillPracticeScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<SkillStatRow[]>([]);
  const [recentQuestionIds, setRecentQuestionIds] = useState<string[]>([]);
  const [structuredProfile, setStructuredProfile] = useState<StructuredProfile | null>(null);

  // Configuration state
  const [activeLevel, setActiveLevel] = useState<ExperienceLevel>("mid");
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [hasProvider, setHasProvider] = useState<boolean | null>(null);

  // User selections
  const [selectedCategory, setSelectedCategory] = useState<"all" | SkillCategory>("all");
  const [selectedSkillId, setSelectedSkillId] = useState<string>(initialSkillId ?? "dsa");
  const [selectedFormat, setSelectedFormat] = useState<DrillFormat>("quick_fire");
  const [inputMode, setInputMode] = useState<InputMode>("text");

  // Interaction & submission state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const categoryTabListId = useId();

  // Load profile, stats, turns, and provider configurations from storage
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);

      const [
        loadedStats,
        loadedSessions,
        loadedTurns,
        loadedProfiles,
        loadedStructured,
        loadedProviders,
      ] = await Promise.all([
        storage.getAll<SkillStatRow>("skillStats"),
        storage.getAll<SessionRow>("sessions"),
        storage.getAll<TurnRow>("turns"),
        storage.getAll<Profile>("profile"),
        storage.getAll<Record<string, unknown>>("structuredProfiles"),
        storage.getAll("providers"),
      ]);

      setHasProvider(loadedProviders.length > 0);

      // Extract recent question IDs from the last 3 sessions for soft repeat avoidance
      const recentSessions = [...loadedSessions]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 3);
      const recentSessionIds = new Set(recentSessions.map((s) => s.id));
      const recentIds = loadedTurns
        .filter((t) => recentSessionIds.has(t.sessionId) && t.questionId)
        .map((t) => t.questionId!);
      setRecentQuestionIds(recentIds);

      // Resolve level & role
      const structLevel = (loadedStructured[0]?.experienceLevel ??
        (loadedStructured[0]?.json as Record<string, unknown> | undefined)?.experienceLevel) as
        | ExperienceLevel
        | undefined;
      const structRole = (loadedStructured[0]?.targetRole ??
        (loadedStructured[0]?.json as Record<string, unknown> | undefined)?.targetRole) as
        | string
        | undefined;

      const resolvedLevel: ExperienceLevel =
        loadedProfiles[0]?.level ?? structLevel ?? loadedSessions[0]?.level ?? "mid";
      const resolvedRole = loadedProfiles[0]?.targetRole ?? structRole ?? "Software Engineer";

      setActiveLevel(resolvedLevel);
      setTargetRole(resolvedRole);
      setStructuredProfile((loadedStructured[0] as StructuredProfile) ?? null);

      const scoredTurns = loadedTurns.filter(
        (t) => t.status === "scored" && t.evaluation !== undefined
      );

      let currentStats = loadedStats;
      if (loadedStats.length === 0 && scoredTurns.length > 0) {
        currentStats = await recomputeAndStoreSkillStats(storage);
      }
      setStats(currentStats);

      // Determine initial skill selection
      if (initialSkillId && CANONICAL_SKILLS.some((s) => s.id === initialSkillId)) {
        setSelectedSkillId(initialSkillId);
      } else {
        const weakest = selectWeakestSkill(
          currentStats,
          CANONICAL_SKILLS.map((s) => s.id)
        );
        if (weakest) {
          setSelectedSkillId(weakest);
        }
      }
    } catch (err) {
      console.error("Failed to load skill practice configuration:", err);
      setHasError(true);
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to load skill practice settings from storage."
      );
    } finally {
      setIsLoading(false);
    }
  }, [storage, initialSkillId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Map stats by skillId
  const statMap = useMemo(
    () => new Map<string, SkillStatRow>(stats.map((s) => [s.skillId, s])),
    [stats]
  );

  // Bank availability across all canonical skills at user's current level
  const bankStats = useMemo(
    () => getBankSkillStats(DEFAULT_QUESTION_BANK, activeLevel),
    [activeLevel]
  );

  // Identified weakest skill for "Fix My Weakest"
  const weakestSkillId = useMemo(
    () =>
      selectWeakestSkill(
        stats,
        CANONICAL_SKILLS.map((s) => s.id)
      ) ?? "dsa",
    [stats]
  );
  const weakestSkillDef = useMemo(
    () => getSkillDefinition(weakestSkillId) ?? CANONICAL_SKILLS[0]!,
    [weakestSkillId]
  );
  const weakestSkillStat = statMap.get(weakestSkillId) ?? null;
  const weakestBankAvail = bankStats[weakestSkillId] ?? { total: 0, atLevel: 0, available: false };

  // Currently selected skill definition & bank availability
  const selectedSkillDef = useMemo(
    () => getSkillDefinition(selectedSkillId) ?? CANONICAL_SKILLS[0]!,
    [selectedSkillId]
  );
  const selectedBankAvail = bankStats[selectedSkillId] ?? {
    total: 0,
    atLevel: 0,
    available: false,
  };
  const isSelectedSkillMissingQuestions = selectedBankAvail.atLevel === 0;

  // Filter skills by category
  const filteredSkills = useMemo(() => {
    if (selectedCategory === "all") return CANONICAL_SKILLS;
    return CANONICAL_SKILLS.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const levelBenchmark = getBenchmarkForLevel(activeLevel);

  // Handle "Fix My Weakest" quick action
  const handleFixWeakest = () => {
    setSelectedSkillId(weakestSkillId);
    setSelectedFormat("quick_fire");
    setValidationError(null);
  };

  // Handle drill start
  const handleStartDrill = async () => {
    setValidationError(null);

    if (hasProvider === false) {
      setValidationError("No AI provider configured. Please complete AI Setup first.");
      return;
    }

    if (isSelectedSkillMissingQuestions) {
      setValidationError(
        `The bank currently has no questions for ${selectedSkillDef.name} at your level. Try a mixed session instead.`
      );
      return;
    }

    setIsStarting(true);
    try {
      const planLength = selectedFormat === "quick_fire" ? 5 : 10;
      const drillPlan: SessionPlan = SessionPlanSchema.parse({
        sessionId: crypto.randomUUID(),
        type: mapSkillToType(selectedSkillDef.category, selectedSkillDef.id),
        length: planLength,
        style: "standard",
        inputMode,
        level: activeLevel,
        targetRole,
        createdAt: new Date().toISOString(),
        isDrill: true,
        targetSkillId: selectedSkillId,
        drillFormat: selectedFormat,
      });

      const result = await selectDrillQuestions({
        plan: drillPlan,
        bank: DEFAULT_QUESTION_BANK,
        targetSkillId: selectedSkillId,
        profile: structuredProfile,
        recentQuestionIds,
      });

      if (result.isBankEmpty || result.questions.length === 0) {
        setValidationError(
          `No questions available for ${selectedSkillDef.name} at this time. Please select another skill or start a mixed session.`
        );
        return;
      }

      onStartDrill(drillPlan, result.questions);
    } catch (err) {
      console.error("Failed to start skill drill:", err);
      setValidationError(
        err instanceof Error ? err.message : "Failed to generate drill session plan."
      );
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="abh-drill-container" aria-busy="true" aria-label="Loading skill practice">
        <Skeleton height="36px" width="300px" />
        <Skeleton height="120px" />
        <Skeleton height="280px" />
        <Skeleton height="80px" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="abh-drill-container">
        <Callout variant="danger" title="Unable to Load Skill Practice">
          {errorMessage}
          <div style={{ marginTop: "var(--space-3)" }}>
            <Button variant="primary" onClick={() => void loadData()}>
              Retry
            </Button>
          </div>
        </Callout>
      </div>
    );
  }

  return (
    <div className="abh-drill-container">
      {/* Header */}
      <header className="abh-drill-header">
        <div className="abh-drill-header-main">
          <h1 className="abh-app-title">Skill Practice_</h1>
          <p className="abh-skills-guidance-pill" role="note">
            Targeted drills update only the selected skill&apos;s calibration statistics.
          </p>
        </div>
        <div className="abh-drill-header-actions">
          {onNavigateSkills && (
            <Button variant="secondary" onClick={onNavigateSkills}>
              📊 View Dashboard
            </Button>
          )}
        </div>
      </header>

      {/* Provider missing warning */}
      {hasProvider === false && (
        <Callout variant="warning" title="AI Provider Required">
          You need an AI provider configured to run practice drills and receive automated scoring.
        </Callout>
      )}

      {/* Recommended Focus: "Fix My Weakest" Card */}
      <section className="abh-weakest-banner" aria-labelledby="weakest-drill-title">
        <div className="abh-weakest-banner-content">
          <div className="abh-weakest-badge-row">
            <span className="abh-weakest-tag">🎯 Recommended Focus</span>
            <span className="abh-target-level-pill">
              Level: {LEVEL_BANDS[activeLevel]?.label ?? activeLevel} (Target: {levelBenchmark}%)
            </span>
          </div>
          <h2 id="weakest-drill-title" className="abh-weakest-banner-title">
            Fix My Weakest: {weakestSkillDef.name}
          </h2>
          <p className="abh-weakest-banner-desc">
            {weakestSkillStat
              ? `Currently calibrated at ${weakestSkillStat.score}% (${getScoreBandLabel(getScoreBand(weakestSkillStat.score))}) with ${weakestSkillStat.confidence} confidence.`
              : "Not yet practiced. Complete a quick drill to begin calibrating this skill."}
          </p>
        </div>
        <div className="abh-weakest-banner-actions">
          <Button
            variant={selectedSkillId === weakestSkillId ? "primary" : "secondary"}
            onClick={handleFixWeakest}
            disabled={weakestBankAvail.atLevel === 0}
          >
            {selectedSkillId === weakestSkillId
              ? "✓ Focus Active"
              : `Select ${weakestSkillDef.name}`}
          </Button>
        </div>
      </section>

      {/* Validation or Error Callout */}
      {validationError && (
        <Callout variant="danger" title="Cannot Start Drill">
          {validationError}
        </Callout>
      )}

      {/* Missing Bank Questions Warning for current selection */}
      {isSelectedSkillMissingQuestions && (
        <Callout
          variant="warning"
          title={`No bank questions at ${LEVEL_BANDS[activeLevel]?.label ?? activeLevel} level`}
        >
          <p>
            The question bank currently has 0 questions for <strong>{selectedSkillDef.name}</strong>{" "}
            at your calibrated experience band.
          </p>
          <p style={{ marginTop: "var(--space-2)" }}>
            You can try a general <strong>Mixed Session</strong> to practice across engineering
            topics, or pick another skill below.
          </p>
          {onStartSession && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <Button variant="primary" onClick={onStartSession}>
                Start Mixed Session Instead
              </Button>
            </div>
          )}
        </Callout>
      )}

      {/* Format & Mode Configuration */}
      <section className="abh-drill-config-grid" aria-labelledby="drill-settings-heading">
        <h2 id="drill-settings-heading" className="abh-visually-hidden">
          Drill Settings
        </h2>

        {/* Drill Format (Quick-Fire vs Deep-Dive) */}
        <div className="abh-drill-config-card">
          <h3 className="abh-drill-section-title">1. Choose Drill Format</h3>
          <div
            className="abh-drill-format-group"
            role="radiogroup"
            aria-label="Drill format options"
          >
            <button
              type="button"
              role="radio"
              aria-checked={selectedFormat === "quick_fire"}
              className={`abh-drill-format-btn ${selectedFormat === "quick_fire" ? "selected" : ""}`}
              onClick={() => setSelectedFormat("quick_fire")}
            >
              <div className="abh-drill-format-header">
                <span className="abh-drill-format-name">⚡ Quick-Fire</span>
                <span className="abh-drill-format-tag">5 questions · ~5–10 min</span>
              </div>
              <p className="abh-drill-format-desc">
                Rapid single-turn answers. No follow-up delay. Great for quick daily drills.
              </p>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={selectedFormat === "deep_dive"}
              className={`abh-drill-format-btn ${selectedFormat === "deep_dive" ? "selected" : ""}`}
              onClick={() => setSelectedFormat("deep_dive")}
            >
              <div className="abh-drill-format-header">
                <span className="abh-drill-format-name">🔍 Deep-Dive</span>
                <span className="abh-drill-format-tag">10 questions · ~15–20 min</span>
              </div>
              <p className="abh-drill-format-desc">
                In-depth questions with probing follow-ups exploring edge cases and trade-offs.
              </p>
            </button>
          </div>
        </div>

        {/* Delivery Modality (Text vs Voice) */}
        <div className="abh-drill-config-card">
          <h3 className="abh-drill-section-title">2. Choose Delivery Mode</h3>
          <div className="abh-drill-format-group" role="radiogroup" aria-label="Input mode options">
            <button
              type="button"
              role="radio"
              aria-checked={inputMode === "text"}
              className={`abh-drill-format-btn ${inputMode === "text" ? "selected" : ""}`}
              onClick={() => setInputMode("text")}
            >
              <div className="abh-drill-format-header">
                <span className="abh-drill-format-name">⌨️ Text Mode</span>
                <span className="abh-drill-format-tag">Self-paced</span>
              </div>
              <p className="abh-drill-format-desc">
                Type responses using the focused editor with live character limits.
              </p>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={inputMode === "voice"}
              className={`abh-drill-format-btn ${inputMode === "voice" ? "selected" : ""}`}
              onClick={() => setInputMode("voice")}
            >
              <div className="abh-drill-format-header">
                <span className="abh-drill-format-name">🎙️ Voice Mode</span>
                <span className="abh-drill-format-tag">Realistic simulation</span>
              </div>
              <p className="abh-drill-format-desc">
                Push-to-talk speech recognition with live subtitle lanes and audio playback.
              </p>
            </button>
          </div>
        </div>
      </section>

      {/* Skill Picker Section */}
      <section className="abh-drill-skills-section" aria-labelledby="skill-picker-heading">
        <div className="abh-drill-skills-header">
          <h2 id="skill-picker-heading" className="abh-drill-section-title">
            3. Select Skill to Drill
          </h2>
          <span className="abh-drill-selected-pill">
            Active: <strong>{selectedSkillDef.name}</strong>
          </span>
        </div>

        {/* Category Tabs */}
        <div
          id={categoryTabListId}
          className="abh-skills-category-tabs"
          role="tablist"
          aria-label="Filter skills by category"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === "all"}
            className={`abh-skills-cat-tab ${selectedCategory === "all" ? "abh-skills-cat-tab--active" : ""}`}
            onClick={() => setSelectedCategory("all")}
          >
            All Skills (15)
          </button>
          {(["technical", "behavioral", "delivery"] as SkillCategory[]).map((cat) => {
            const info = CATEGORY_META[cat];
            const count = CANONICAL_SKILLS.filter((s) => s.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat}
                className={`abh-skills-cat-tab ${selectedCategory === cat ? "abh-skills-cat-tab--active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span>{info.icon}</span>
                <span>{info.label}</span>
                <span className="abh-skills-cat-avg">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Skills Grid */}
        <div className="abh-drill-skills-grid" role="radiogroup" aria-label="Skill selection list">
          {filteredSkills.map((skill) => {
            const stat = statMap.get(skill.id) ?? null;
            const isSelected = selectedSkillId === skill.id;
            const isWeakest = skill.id === weakestSkillId;
            const bStat = bankStats[skill.id] ?? { total: 0, atLevel: 0, available: false };
            const isBankEmptyAtLevel = bStat.atLevel === 0;
            const catInfo = CATEGORY_META[skill.category];

            return (
              <button
                key={skill.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`abh-drill-skill-card ${isSelected ? "selected" : ""} ${isBankEmptyAtLevel ? "missing-bank" : ""}`}
                onClick={() => {
                  setSelectedSkillId(skill.id);
                  setValidationError(null);
                }}
              >
                <div className="abh-drill-skill-top">
                  <span
                    className="abh-drill-skill-icon"
                    style={{ borderColor: catInfo.tokenVar }}
                    aria-hidden="true"
                  >
                    {catInfo.icon}
                  </span>
                  <div className="abh-drill-skill-meta">
                    <span className="abh-drill-skill-name">{skill.name}</span>
                    <span className="abh-drill-skill-category" style={{ color: catInfo.tokenVar }}>
                      {catInfo.label}
                    </span>
                  </div>
                  {isWeakest && <span className="abh-weakest-tag">WEAKEST</span>}
                </div>

                <p className="abh-drill-skill-desc">{skill.description}</p>

                <div className="abh-drill-skill-bottom">
                  {/* Score & Confidence */}
                  <div className="abh-drill-skill-score">
                    {stat ? (
                      <>
                        <span className="abh-drill-score-num">{stat.score}%</span>
                        <span className="abh-drill-score-band">
                          {getScoreBandLabel(getScoreBand(stat.score))}
                        </span>
                        <span className="abh-drill-conf-tag">{stat.confidence} conf</span>
                      </>
                    ) : (
                      <span className="abh-drill-unpracticed">Unpracticed</span>
                    )}
                  </div>

                  {/* Bank Availability Badge */}
                  <div className="abh-drill-bank-status">
                    {bStat.atLevel > 0 ? (
                      <span className="abh-bank-avail-pill">✓ {bStat.atLevel} in bank</span>
                    ) : (
                      <span className="abh-bank-empty-pill">0 in bank (level)</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Start Drill Action Bar */}
      <footer className="abh-drill-footer">
        <div className="abh-drill-footer-summary">
          <span>
            Targeting: <strong>{selectedSkillDef.name}</strong>
          </span>
          <span>•</span>
          <span>
            Format:{" "}
            <strong>
              {selectedFormat === "quick_fire" ? "Quick-Fire (5 Qs)" : "Deep-Dive (10 Qs)"}
            </strong>
          </span>
          <span>•</span>
          <span>
            Mode: <strong>{inputMode === "text" ? "Text" : "Voice"}</strong>
          </span>
        </div>
        <div className="abh-drill-footer-buttons">
          <Button
            variant="primary"
            disabled={isSelectedSkillMissingQuestions || isStarting || hasProvider === false}
            onClick={handleStartDrill}
          >
            {isStarting
              ? "Preparing Drill..."
              : `Start ${selectedFormat === "quick_fire" ? "Quick-Fire" : "Deep-Dive"} Drill (${selectedFormat === "quick_fire" ? "5" : "10"} questions)`}
          </Button>
          {onNavigateHome && (
            <Button variant="ghost" onClick={onNavigateHome}>
              Cancel
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
