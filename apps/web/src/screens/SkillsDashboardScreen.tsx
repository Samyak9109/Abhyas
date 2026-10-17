// FR-015, design.md 8 & 9 (PG-15): Skills calibration dashboard.
// Visualizes strengths, gaps, confidence markers, trend lines, stale skills, level benchmarks, and accessible table alternative.

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  getBenchmarkForLevel,
  getScoreBand,
  getScoreBandLabel,
  isSkillStale,
  LEVEL_BANDS,
  selectStrongestSkills,
  selectWeakestSkills,
  computeSkillHistory,
  type ExperienceLevel,
  type SkillCategory,
  type SkillDefinition,
  type SkillHistoryPoint,
  type SkillStatRow,
  type SessionRow,
  type StorageAdapter,
  type TurnRow,
} from "@abhyas/core";
import { CANONICAL_SKILLS, getSkillDefinition } from "@abhyas/content";
import { Button, Callout, Mascot, Skeleton } from "../components";
import { recomputeAndStoreSkillStats } from "../services/skills-recompute";

interface SkillsDashboardScreenProps {
  storage: StorageAdapter;
  onPracticeSkill?: (skillId: string) => void;
  onStartSession?: () => void;
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
    description: "Core algorithms, system architecture, database design, and coding precision.",
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

function getCategoryMeta(cat: SkillCategory): CategoryInfo {
  return CATEGORY_META[cat] ?? CATEGORY_META.technical;
}

export function SkillsDashboardScreen({
  storage,
  onPracticeSkill,
  onStartSession,
  onNavigateHome,
}: SkillsDashboardScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<SkillStatRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [activeLevel, setActiveLevel] = useState<ExperienceLevel>("mid");

  // UI state
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [selectedCategory, setSelectedCategory] = useState<"all" | SkillCategory>("all");
  const [inspectSkillId, setInspectSkillId] = useState<string | null>(null);

  const tableCaptionId = useId();

  // Load data from storage, recomputing stats if needed
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);

      const [loadedStats, loadedSessions, loadedTurns, loadedProfiles, loadedStructured] =
        await Promise.all([
          storage.getAll<SkillStatRow>("skillStats"),
          storage.getAll<SessionRow>("sessions"),
          storage.getAll<TurnRow>("turns"),
          storage.getAll<{ level?: ExperienceLevel }>("profile"),
          storage.getAll<Record<string, unknown>>("structuredProfiles"),
        ]);

      setSessions(loadedSessions);
      setTurns(loadedTurns);

      const structLevel = (loadedStructured[0]?.experienceLevel ??
        (loadedStructured[0]?.json as Record<string, unknown> | undefined)?.experienceLevel) as
        | ExperienceLevel
        | undefined;
      const resolvedLevel: ExperienceLevel =
        loadedProfiles[0]?.level ?? structLevel ?? loadedSessions[0]?.level ?? "mid";
      setActiveLevel(resolvedLevel);

      const scoredTurns = loadedTurns.filter(
        (t) => t.status === "scored" && t.evaluation !== undefined
      );

      // If we have scored turns but stats are empty, trigger recompute
      if (loadedStats.length === 0 && scoredTurns.length > 0) {
        const freshStats = await recomputeAndStoreSkillStats(storage);
        setStats(freshStats);
      } else {
        setStats(loadedStats);
      }
    } catch (err) {
      console.error("Failed to load skills dashboard:", err);
      setHasError(true);
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to load skill statistics from storage."
      );
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Derived metrics
  const scoredTurns = useMemo(
    () => turns.filter((t) => t.status === "scored" && t.evaluation !== undefined),
    [turns]
  );

  const benchmarkScore = getBenchmarkForLevel(activeLevel);
  const levelBandConfig = LEVEL_BANDS[activeLevel];

  // Map stats by skillId for fast lookup
  const statMap = useMemo(
    () => new Map<string, SkillStatRow>(stats.map((s) => [s.skillId, s])),
    [stats]
  );

  // Merge canonical skills with statistics
  const skillItems: { definition: SkillDefinition; stat: SkillStatRow | null; isStale: boolean }[] =
    useMemo(() => {
      return CANONICAL_SKILLS.map((skill) => {
        const stat = statMap.get(skill.id);
        const isStale = stat ? isSkillStale(stat.lastPracticedAt) : false;
        return {
          definition: skill,
          stat: stat ?? null,
          isStale,
        };
      });
    }, [statMap]);

  // Filtered skills by category
  const filteredSkills = useMemo(() => {
    if (selectedCategory === "all") return skillItems;
    return skillItems.filter((item) => item.definition.category === selectedCategory);
  }, [skillItems, selectedCategory]);

  // Weakest and Strongest skills
  const weakestSkills = useMemo(() => selectWeakestSkills(stats, 3), [stats]);
  const strongestSkills = useMemo(() => selectStrongestSkills(stats, 3), [stats]);

  // Category summary scores
  const categoryAverages = useMemo(() => {
    const categories: SkillCategory[] = ["technical", "behavioral", "delivery"];
    const avgs: Record<SkillCategory, { mean: number; count: number }> = {
      technical: { mean: 0, count: 0 },
      behavioral: { mean: 0, count: 0 },
      delivery: { mean: 0, count: 0 },
    };

    for (const cat of categories) {
      const catStats = stats.filter((s) => {
        const def = getSkillDefinition(s.skillId);
        return def?.category === cat;
      });
      if (catStats.length > 0) {
        const total = catStats.reduce((sum, s) => sum + s.score, 0);
        avgs[cat] = {
          mean: Math.round((total / catStats.length) * 10) / 10,
          count: catStats.length,
        };
      }
    }
    return avgs;
  }, [stats]);

  // Dynamic takeaway sentence (design.md 9: "Every chart has a title, a one-sentence takeaway...")
  const takeaway = useMemo(() => {
    if (stats.length === 0) {
      return "Complete your first interview session to calibrate your skills and discover your strengths.";
    }

    if (sessions.length <= 1) {
      return "Early calibration based on your first session. Practice 2–3 more sessions for calibrated benchmarks and trends.";
    }

    if (strongestSkills.length > 0 && weakestSkills.length > 0) {
      const strongestDef = getSkillDefinition(strongestSkills[0]!.skillId);
      const weakestDef = getSkillDefinition(weakestSkills[0]!.skillId);
      return `You're strongest in ${strongestDef?.name ?? strongestSkills[0]!.skillId} (${strongestSkills[0]!.score}%), with the biggest growth opportunity in ${weakestDef?.name ?? weakestSkills[0]!.skillId} (${weakestSkills[0]!.score}%).`;
    }

    return "Continue practicing across diverse interview question types to increase statistical confidence.";
  }, [stats, sessions, strongestSkills, weakestSkills]);

  // Inspected skill history for trend sparkline/drawer
  const inspectHistory: SkillHistoryPoint[] = useMemo(() => {
    if (!inspectSkillId) return [];
    return computeSkillHistory(turns, sessions, inspectSkillId);
  }, [inspectSkillId, turns, sessions]);

  const inspectSkillDef = useMemo(() => {
    if (!inspectSkillId) return null;
    return getSkillDefinition(inspectSkillId) ?? null;
  }, [inspectSkillId]);

  const inspectStat = useMemo(() => {
    if (!inspectSkillId) return null;
    return statMap.get(inspectSkillId) ?? null;
  }, [inspectSkillId, statMap]);

  // ---------------------------------------------------------------------------
  // Render Loading State (Section 7.4 Screen states)
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="abh-skills-dashboard abh-skills-dashboard--loading" aria-busy="true">
        <Skeleton style={{ height: "40px", width: "320px", marginBottom: "var(--space-4)" }} />
        <Skeleton style={{ height: "60px", width: "100%", marginBottom: "var(--space-6)" }} />
        <div className="abh-skills-summary-grid">
          <Skeleton style={{ height: "100px" }} />
          <Skeleton style={{ height: "100px" }} />
          <Skeleton style={{ height: "100px" }} />
          <Skeleton style={{ height: "100px" }} />
        </div>
        <div style={{ marginTop: "var(--space-6)" }}>
          <Skeleton style={{ height: "300px" }} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Error State
  // ---------------------------------------------------------------------------
  if (hasError) {
    return (
      <div className="abh-skills-dashboard">
        <Callout variant="danger" title="Unable to load skills data">
          <p>{errorMessage}</p>
          <div style={{ marginTop: "var(--space-3)" }}>
            <Button variant="secondary" onClick={() => void loadData()}>
              Retry
            </Button>
          </div>
        </Callout>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Empty State (Zero sessions / zero turns)
  // ---------------------------------------------------------------------------
  if (sessions.length === 0 || scoredTurns.length === 0) {
    return (
      <div className="abh-skills-dashboard abh-skills-dashboard--empty">
        <header className="abh-skills-header">
          <h1 className="abh-app-title">Skills Dashboard_</h1>
        </header>

        <section className="abh-skills-empty-card" aria-label="No data available">
          <div className="abh-skills-empty-mascot">
            <Mascot face="ready" size="card" />
          </div>
          <h2 className="abh-skills-empty-title">No interview data yet</h2>
          <p className="abh-skills-empty-text">
            Complete an interview session to calibrate your technical, behavioral, and delivery
            skills. Your answers are evaluated client-side against calibrated level rubrics.
          </p>
          <p className="abh-skills-empty-subtext">
            No telemetry or server tracking — all skill progress stays completely local on your
            device.
          </p>
          <div className="abh-skills-empty-actions">
            <Button
              variant="primary"
              onClick={() => {
                if (onStartSession) {
                  onStartSession();
                } else if (onPracticeSkill) {
                  onPracticeSkill("dsa");
                }
              }}
            >
              Start Practice Session
            </Button>
            {onNavigateHome && (
              <Button variant="ghost" onClick={onNavigateHome}>
                Back to Home
              </Button>
            )}
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render Ready State (Dashboard with data)
  // ---------------------------------------------------------------------------
  const isOneSession = sessions.length === 1;

  return (
    <div className="abh-skills-dashboard">
      {/* Header and Disclosures */}
      <header className="abh-skills-header">
        <div className="abh-skills-header-main">
          <h1 className="abh-app-title">Skills Dashboard_</h1>
          <p className="abh-skills-guidance-pill" role="note">
            Results are guidance to help you prepare, not hiring verdicts.
          </p>
        </div>

        <div className="abh-skills-view-toggle" role="group" aria-label="View representation">
          <Button
            variant={viewMode === "chart" ? "primary" : "secondary"}
            onClick={() => setViewMode("chart")}
            aria-pressed={viewMode === "chart"}
          >
            📊 Chart View
          </Button>
          <Button
            variant={viewMode === "table" ? "primary" : "secondary"}
            onClick={() => setViewMode("table")}
            aria-pressed={viewMode === "table"}
          >
            📋 View as Table
          </Button>
        </div>
      </header>

      {/* One session notice / Early calibration warning */}
      {isOneSession && (
        <aside className="abh-skills-notice" aria-label="Early calibration notice">
          <Callout variant="info" title="Early Calibration (1 session completed)">
            <p>
              Your dashboard currently reflects only 1 completed session. Confidence levels are low
              until 3–8 answers are recorded per skill. Practice across multiple sessions to
              establish durable benchmarks.
            </p>
          </Callout>
        </aside>
      )}

      {/* Overview Stat Strip */}
      <section className="abh-skills-summary-grid" aria-label="Summary Statistics">
        <div className="abh-skills-summary-card">
          <span className="abh-skills-summary-label">Scored Answers</span>
          <span className="abh-skills-summary-value">{scoredTurns.length}</span>
          <span className="abh-skills-summary-sub">across {sessions.length} sessions</span>
        </div>

        <div className="abh-skills-summary-card">
          <span className="abh-skills-summary-label">Target Level</span>
          <span className="abh-skills-summary-value">{levelBandConfig.label}</span>
          <span className="abh-skills-summary-sub">Benchmark: {benchmarkScore}% target</span>
        </div>

        <div className="abh-skills-summary-card">
          <span className="abh-skills-summary-label">Strongest Skill</span>
          <span className="abh-skills-summary-value">
            {strongestSkills.length > 0
              ? (getSkillDefinition(strongestSkills[0]!.skillId)?.name ??
                strongestSkills[0]!.skillId)
              : "Calibrating..."}
          </span>
          <span className="abh-skills-summary-sub">
            {strongestSkills.length > 0
              ? `${strongestSkills[0]!.score}% score`
              : "Needs >= 3 answers"}
          </span>
        </div>

        <div className="abh-skills-summary-card">
          <span className="abh-skills-summary-label">Focus Area</span>
          <span className="abh-skills-summary-value">
            {weakestSkills.length > 0
              ? (getSkillDefinition(weakestSkills[0]!.skillId)?.name ?? weakestSkills[0]!.skillId)
              : "None"}
          </span>
          <span className="abh-skills-summary-sub">
            {weakestSkills.length > 0
              ? `${weakestSkills[0]!.score}% (${weakestSkills[0]!.confidence} conf)`
              : "Great coverage"}
          </span>
        </div>
      </section>

      {/* Category Filter Pills */}
      <div className="abh-skills-category-tabs" role="tablist" aria-label="Skill categories">
        <button
          type="button"
          role="tab"
          aria-selected={selectedCategory === "all"}
          className={`abh-skills-cat-tab ${selectedCategory === "all" ? "abh-skills-cat-tab--active" : ""}`}
          onClick={() => setSelectedCategory("all")}
        >
          All Skills ({skillItems.length})
        </button>
        {(["technical", "behavioral", "delivery"] as const).map((cat) => {
          const meta = getCategoryMeta(cat);
          const avg = categoryAverages[cat] ?? { mean: 0, count: 0 };
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              className={`abh-skills-cat-tab ${selectedCategory === cat ? "abh-skills-cat-tab--active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              {avg.count > 0 && <span className="abh-skills-cat-avg">{avg.mean}%</span>}
            </button>
          );
        })}
      </div>

      {/* Chart View Representation */}
      {viewMode === "chart" && (
        <section className="abh-skills-chart-frame" aria-label="Skill Performance Chart">
          {/* Chart Header & Takeaway (design.md 9) */}
          <div className="abh-skills-chart-header">
            <h2 className="abh-skills-chart-title">Skill Calibration Chart</h2>
            <p className="abh-skills-takeaway" role="doc-subtitle">
              {takeaway}
            </p>
            <p className="abh-skills-answers-note">
              Based on {scoredTurns.length} scored answers across {sessions.length} sessions. Level
              benchmark target is {benchmarkScore}% for {levelBandConfig.label}.
            </p>
          </div>

          {/* Grouped Category Bars */}
          <div className="abh-skills-groups">
            {(["technical", "behavioral", "delivery"] as const)
              .filter((cat) => selectedCategory === "all" || selectedCategory === cat)
              .map((cat) => {
                const meta = getCategoryMeta(cat);
                const catSkills = filteredSkills.filter((item) => item.definition.category === cat);
                if (catSkills.length === 0) return null;

                const catAvg = categoryAverages[cat] ?? { mean: 0, count: 0 };

                return (
                  <div key={cat} className="abh-skills-category-group">
                    <div className="abh-skills-group-header">
                      <div className="abh-skills-group-title-row">
                        <span className="abh-skills-group-icon" aria-hidden="true">
                          {meta.icon}
                        </span>
                        <h3 className="abh-skills-group-title">{meta.label}</h3>
                        {catAvg.count > 0 && (
                          <span
                            className="abh-skills-group-pill"
                            style={{ borderColor: meta.tokenVar, color: meta.tokenVar }}
                          >
                            Category Avg: {catAvg.mean}%
                          </span>
                        )}
                      </div>
                      <p className="abh-skills-group-desc">{meta.description}</p>
                    </div>

                    <div className="abh-skills-bars-list" role="list">
                      {catSkills.map((item) => {
                        const { definition, stat, isStale } = item;
                        const score = stat ? stat.score : 0;
                        const band = getScoreBand(score);
                        const isLowConfidence = stat ? stat.confidence === "low" : true;
                        const n = stat ? stat.n : 0;
                        const trend = stat?.trend;

                        return (
                          <div
                            key={definition.id}
                            className={`abh-skill-bar-row ${stat ? "" : "abh-skill-bar-row--unpracticed"} ${
                              inspectSkillId === definition.id ? "abh-skill-bar-row--selected" : ""
                            }`}
                            role="listitem"
                          >
                            <div className="abh-skill-bar-info">
                              <div className="abh-skill-bar-name-row">
                                <button
                                  type="button"
                                  className="abh-skill-name-btn"
                                  onClick={() =>
                                    setInspectSkillId(
                                      inspectSkillId === definition.id ? null : definition.id
                                    )
                                  }
                                  aria-expanded={inspectSkillId === definition.id}
                                  title={`Inspect score history for ${definition.name}`}
                                >
                                  <span className="abh-skill-name-text">{definition.name}</span>
                                </button>

                                {/* Badges */}
                                <div className="abh-skill-badges">
                                  {isStale && (
                                    <span
                                      className="abh-badge abh-badge--warning"
                                      title="Not practiced in over 14 days"
                                    >
                                      Needs refresh
                                    </span>
                                  )}

                                  {stat && isLowConfidence && (
                                    <span
                                      className="abh-badge abh-badge--low-confidence"
                                      title="Low confidence (under 3 answers recorded)"
                                    >
                                      Low confidence ({n})
                                    </span>
                                  )}

                                  {stat && !isLowConfidence && (
                                    <span
                                      className={`abh-badge abh-badge--${stat.confidence}`}
                                      title={`Sample size: ${n} answers`}
                                    >
                                      {stat.confidence} conf ({n})
                                    </span>
                                  )}

                                  {typeof trend === "number" && (
                                    <span
                                      className={`abh-badge abh-badge--trend ${
                                        trend > 0
                                          ? "abh-badge--trend-up"
                                          : trend < 0
                                            ? "abh-badge--trend-down"
                                            : ""
                                      }`}
                                      title={`Trend: last 5 vs previous 5 answers (${trend > 0 ? "+" : ""}${trend}%)`}
                                    >
                                      {trend > 0
                                        ? `↗ +${trend}%`
                                        : trend < 0
                                          ? `↘ ${trend}%`
                                          : `→ ${trend}%`}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <p className="abh-skill-description">{definition.description}</p>
                            </div>

                            {/* Bar & Target Benchmark Marker */}
                            <div className="abh-skill-bar-track-wrap">
                              <div
                                className={`abh-skill-bar-track ${
                                  isLowConfidence ? "abh-skill-bar-track--dashed" : ""
                                }`}
                                role="progressbar"
                                aria-valuenow={stat ? score : 0}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${definition.name} score`}
                              >
                                <div
                                  className={`abh-skill-bar-fill ${
                                    isLowConfidence ? "abh-skill-bar-fill--low-conf" : ""
                                  }`}
                                  style={{
                                    width: `${stat ? score : 0}%`,
                                    backgroundColor: meta.tokenVar,
                                  }}
                                />

                                {/* Level Benchmark Marker */}
                                <div
                                  className="abh-skill-benchmark-line"
                                  style={{ left: `${benchmarkScore}%` }}
                                  title={`Target level benchmark: ${benchmarkScore}%`}
                                  aria-hidden="true"
                                />
                              </div>

                              {/* Numeric and Rating Column */}
                              <div className="abh-skill-bar-metrics">
                                <span className="abh-skill-score-num">
                                  {stat ? `${score}%` : "—"}
                                </span>
                                {stat && (
                                  <span
                                    className={`abh-skill-band-tag abh-skill-band-tag--${band}`}
                                  >
                                    {getScoreBandLabel(band)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Button */}
                            <div className="abh-skill-row-action">
                              <Button
                                variant="secondary"
                                onClick={() => onPracticeSkill?.(definition.id)}
                                title={`Practice a focused drill for ${definition.name}`}
                              >
                                Practice Drill
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* Table Alternative ("View as table" - design.md 9 & 8) */}
      {viewMode === "table" && (
        <section className="abh-skills-table-frame" aria-label="Skill Performance Table">
          <div className="abh-skills-chart-header">
            <h2 className="abh-skills-chart-title">Skill Calibration Table</h2>
            <p className="abh-skills-takeaway" role="doc-subtitle">
              {takeaway}
            </p>
            <p className="abh-skills-answers-note">
              Based on {scoredTurns.length} scored answers across {sessions.length} sessions. Level
              benchmark target is {benchmarkScore}% for {levelBandConfig.label}.
            </p>
          </div>
          <div className="abh-skills-table-responsive">
            <table className="abh-skills-table">
              <caption id={tableCaptionId} className="abh-visually-hidden">
                Skills Calibration Table showing scores, confidence, and trends across all skills.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Skill</th>
                  <th scope="col">Category</th>
                  <th scope="col">Score</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Confidence</th>
                  <th scope="col">Trend</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last Practiced</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkills.map(({ definition, stat, isStale }) => {
                  const score = stat ? stat.score : 0;
                  const band = getScoreBand(score);
                  const n = stat ? stat.n : 0;
                  const trend = stat?.trend;
                  const meta = getCategoryMeta(definition.category);

                  return (
                    <tr key={definition.id}>
                      <th scope="row" className="abh-skill-table-name">
                        <span className="abh-skill-table-icon">{meta.icon}</span>
                        <span>{definition.name}</span>
                      </th>
                      <td>{meta.label}</td>
                      <td className="abh-skill-table-mono">
                        {stat ? `${score.toFixed(1)}%` : "Not evaluated"}
                      </td>
                      <td>
                        {stat ? (
                          <span className={`abh-skill-band-tag abh-skill-band-tag--${band}`}>
                            {getScoreBandLabel(band)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {stat ? (
                          <span className={`abh-badge abh-badge--${stat.confidence}`}>
                            {stat.confidence} ({n} {n === 1 ? "answer" : "answers"})
                          </span>
                        ) : (
                          "0 answers"
                        )}
                      </td>
                      <td className="abh-skill-table-mono">
                        {typeof trend === "number" ? (
                          <span
                            className={
                              trend > 0
                                ? "abh-trend-positive"
                                : trend < 0
                                  ? "abh-trend-negative"
                                  : ""
                            }
                          >
                            {trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`}
                          </span>
                        ) : (
                          <span className="abh-text-muted">Need 10+</span>
                        )}
                      </td>
                      <td>
                        {isStale ? (
                          <span className="abh-badge abh-badge--warning">Needs refresh</span>
                        ) : stat ? (
                          <span className="abh-text-muted">Active</span>
                        ) : (
                          <span className="abh-text-muted">Unpracticed</span>
                        )}
                      </td>
                      <td className="abh-skill-table-date">
                        {stat ? new Date(stat.lastPracticedAt).toLocaleDateString() : "Never"}
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => onPracticeSkill?.(definition.id)}
                        >
                          Practice
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Focus Area: Weakest & Strongest Cards */}
      <section className="abh-skills-focus-section" aria-labelledby="focus-areas-heading">
        <h2 id="focus-areas-heading" className="abh-visually-hidden">
          Skill Focus Areas and Strengths
        </h2>
        <div className="abh-skills-focus-grid" aria-label="Strengths and Weaknesses">
          {/* Weakest Skills */}
          <div className="abh-skills-focus-card abh-skills-focus-card--weakest">
            <div className="abh-skills-focus-card-header">
              <span className="abh-skills-focus-badge abh-skills-focus-badge--weak">
                ⚠️ Focus Areas
              </span>
              <h3 className="abh-skills-focus-card-title">Weakest Skills</h3>
              <p className="abh-skills-focus-card-sub">
                Prioritized by lowest scores with statistical confidence.
              </p>
            </div>

            {weakestSkills.length === 0 ? (
              <p className="abh-text-muted">All practiced skills are scoring well!</p>
            ) : (
              <ul className="abh-focus-list">
                {weakestSkills.map((w) => {
                  const def = getSkillDefinition(w.skillId);
                  const band = getScoreBand(w.score);
                  return (
                    <li key={w.skillId} className="abh-focus-list-item">
                      <div className="abh-focus-item-content">
                        <span className="abh-focus-item-name">{def?.name ?? w.skillId}</span>
                        <span className="abh-focus-item-meta">
                          Score: <strong>{w.score}%</strong> • {w.confidence} confidence ({w.n}{" "}
                          answers)
                        </span>
                      </div>
                      <div className="abh-focus-item-action">
                        <span className={`abh-skill-band-tag abh-skill-band-tag--${band}`}>
                          {getScoreBandLabel(band)}
                        </span>
                        <Button variant="secondary" onClick={() => onPracticeSkill?.(w.skillId)}>
                          Drill
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Strongest Skills */}
          <div className="abh-skills-focus-card abh-skills-focus-card--strongest">
            <div className="abh-skills-focus-card-header">
              <span className="abh-skills-focus-badge abh-skills-focus-badge--strong">
                🌟 Strengths
              </span>
              <h3 className="abh-skills-focus-card-title">Top Demonstrations</h3>
              <p className="abh-skills-focus-card-sub">
                Highest scoring skills with verified medium/high confidence.
              </p>
            </div>

            {strongestSkills.length === 0 ? (
              <p className="abh-text-muted">
                Needs at least 3 answers in a skill to register a verified strength.
              </p>
            ) : (
              <ul className="abh-focus-list">
                {strongestSkills.map((s) => {
                  const def = getSkillDefinition(s.skillId);
                  const band = getScoreBand(s.score);
                  return (
                    <li key={s.skillId} className="abh-focus-list-item">
                      <div className="abh-focus-item-content">
                        <span className="abh-focus-item-name">{def?.name ?? s.skillId}</span>
                        <span className="abh-focus-item-meta">
                          Score: <strong>{s.score}%</strong> • {s.confidence} confidence ({s.n}{" "}
                          answers)
                        </span>
                      </div>
                      <div className="abh-focus-item-action">
                        <span className={`abh-skill-band-tag abh-skill-band-tag--${band}`}>
                          {getScoreBandLabel(band)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Inspect Trend Line Modal / Drawer (when a skill is clicked) */}
      {inspectSkillId && inspectSkillDef && (
        <section
          className="abh-skills-inspect-drawer"
          aria-label={`Detailed Trend History for ${inspectSkillDef.name}`}
        >
          <div className="abh-skills-inspect-header">
            <div>
              <span className="abh-badge abh-badge--info">
                {getCategoryMeta(inspectSkillDef.category).label}
              </span>
              <h3 className="abh-skills-inspect-title">
                {inspectSkillDef.name} — Score History & Trend
              </h3>
            </div>
            <Button
              variant="ghost"
              onClick={() => setInspectSkillId(null)}
              aria-label="Close trend details"
            >
              ✕ Close
            </Button>
          </div>

          <div className="abh-skills-inspect-body">
            <div className="abh-skills-inspect-stats">
              <div>
                <span className="abh-text-muted">Recency-Weighted Score:</span>{" "}
                <strong>{inspectStat ? `${inspectStat.score}%` : "Not evaluated"}</strong>
              </div>
              <div>
                <span className="abh-text-muted">Total Answers:</span>{" "}
                <strong>{inspectHistory.length}</strong>
              </div>
              {inspectStat && typeof inspectStat.trend === "number" && (
                <div>
                  <span className="abh-text-muted">10-Turn Trend:</span>{" "}
                  <strong>
                    {inspectStat.trend > 0 ? `+${inspectStat.trend}%` : `${inspectStat.trend}%`}
                  </strong>
                </div>
              )}
            </div>

            {/* Sparkline / Trend Points (design.md 9: show points, only with enough data) */}
            {inspectHistory.length > 0 ? (
              <div className="abh-trend-chart-container">
                <svg
                  className="abh-trend-svg"
                  viewBox="0 0 500 120"
                  role="img"
                  aria-label={`Trend chart for ${inspectSkillDef.name}`}
                >
                  {/* Grid lines */}
                  <line
                    x1="0"
                    y1="20"
                    x2="500"
                    y2="20"
                    stroke="var(--line)"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="0"
                    y1="60"
                    x2="500"
                    y2="60"
                    stroke="var(--line)"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2="500"
                    y2="100"
                    stroke="var(--line)"
                    strokeDasharray="3 3"
                  />

                  {/* Level Benchmark line */}
                  <line
                    x1="0"
                    y1={120 - (benchmarkScore / 100) * 100}
                    x2="500"
                    y2={120 - (benchmarkScore / 100) * 100}
                    stroke="var(--accent-primary)"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Connect points with polyline */}
                  {inspectHistory.length > 1 && (
                    <polyline
                      fill="none"
                      stroke={getCategoryMeta(inspectSkillDef.category).tokenVar}
                      strokeWidth="2.5"
                      points={inspectHistory
                        .map((pt, idx) => {
                          const x =
                            inspectHistory.length === 1
                              ? 250
                              : 20 + (idx / (inspectHistory.length - 1)) * 460;
                          const y = 110 - (pt.score / 100) * 90;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  )}

                  {/* Discrete data points */}
                  {inspectHistory.map((pt, idx) => {
                    const x =
                      inspectHistory.length === 1
                        ? 250
                        : 20 + (idx / (inspectHistory.length - 1)) * 460;
                    const y = 110 - (pt.score / 100) * 90;
                    return (
                      <g key={pt.turnId}>
                        <circle
                          cx={x}
                          cy={y}
                          r="5"
                          fill="var(--bg)"
                          stroke={getCategoryMeta(inspectSkillDef.category).tokenVar}
                          strokeWidth="2"
                        />
                        <text
                          x={x}
                          y={y - 8}
                          fontSize="10"
                          textAnchor="middle"
                          fill="var(--text)"
                          fontFamily="var(--font-mono)"
                        >
                          {pt.score}%
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <p className="abh-trend-legend">
                  <span>
                    Dashed orange line: {levelBandConfig.label} benchmark ({benchmarkScore}%)
                  </span>
                  {inspectHistory.length < 10 && (
                    <span className="abh-text-muted">
                      • Official trend calculation requires at least 10 answers (currently{" "}
                      {inspectHistory.length}).
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <p className="abh-text-muted">No answers recorded for this skill yet.</p>
            )}

            <div style={{ marginTop: "var(--space-4)" }}>
              <Button variant="primary" onClick={() => onPracticeSkill?.(inspectSkillDef.id)}>
                Practice Drill for {inspectSkillDef.name}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
