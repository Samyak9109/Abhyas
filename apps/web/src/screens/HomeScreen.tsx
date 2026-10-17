// FR-018, design.md 8 (PG-14): Home screen (full implementation with habit, streaks, daily drill).
import React, { useEffect, useState } from "react";
import {
  computeSessionScorecard,
  computeStreak,
  getDailyDrillRecommendation,
  type DailyDrillRecommendation,
  type SessionRow,
  type SkillStatRow,
  type StorageAdapter,
  type StreakState,
  type StructuredProfile,
  type TurnRow,
} from "@abhyas/core";
import { getSkillDefinition } from "@abhyas/content";
import { Button, Mascot, Progress, Skeleton } from "../components";

interface HomeScreenProps {
  storage: StorageAdapter;
  onStartSession: () => void;
  onViewResults: (sessionId: string) => void;
  onStartDailyDrill?: (skillId: string) => void;
  onNavigateHistory?: () => void;
  onNavigateSettings?: () => void;
  onNavigateProfile?: () => void;
  onNavigateSkills?: () => void;
}

interface SessionSummaryItem {
  session: SessionRow;
  turnsCount: number;
  overallScore: number | null;
  targetRole: string;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  storage,
  onStartSession,
  onViewResults,
  onStartDailyDrill,
  onNavigateHistory,
  onNavigateSettings,
  onNavigateProfile,
  onNavigateSkills,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summaries, setSummaries] = useState<SessionSummaryItem[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [dailyDrill, setDailyDrill] = useState<DailyDrillRecommendation | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setIsLoading(true);
        const [allSessions, allTurns, allProfiles, allSkillStats] = await Promise.all([
          storage.getAll<SessionRow>("sessions"),
          storage.getAll<TurnRow>("turns"),
          storage.getAll<StructuredProfile>("structuredProfiles"),
          storage.getAll<SkillStatRow>("skillStats"),
        ]);

        if (!active) return;

        // Sort sessions descending by startedAt
        const sortedSessions = [...allSessions].sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        setSessions(sortedSessions);
        setHasProfile(allProfiles.length > 0);

        // Compute habit streak and daily drill recommendation
        const computedStreak = computeStreak(allSessions);
        const computedDrill = getDailyDrillRecommendation(allSessions, allSkillStats);

        setStreak(computedStreak);
        setDailyDrill(computedDrill);

        // Precompute session score summaries
        const items: SessionSummaryItem[] = sortedSessions.map((s) => {
          const sessionTurns = allTurns.filter((t) => t.sessionId === s.id);
          let overallScore: number | null = null;
          if (sessionTurns.length > 0) {
            try {
              const card = computeSessionScorecard(s, sessionTurns);
              overallScore = card.overallScore;
            } catch {
              overallScore = null;
            }
          }

          let role = "Software Engineer";
          if (typeof s.plan === "object" && s.plan !== null && "targetRole" in s.plan) {
            role = String((s.plan as { targetRole: unknown }).targetRole);
          }

          return {
            session: s,
            turnsCount: sessionTurns.length,
            overallScore,
            targetRole: role,
          };
        });

        setSummaries(items);
      } catch (err) {
        console.error("Failed to load home screen data:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [storage]);

  if (isLoading) {
    return (
      <div className="abh-home" aria-busy="true" aria-label="Loading home screen">
        <div className="abh-home-container">
          <Skeleton height="40px" />
          <Skeleton height="160px" />
          <Skeleton height="280px" />
        </div>
      </div>
    );
  }

  const isFirstTime = sessions.length === 0;
  const drillSkillDef = dailyDrill ? getSkillDefinition(dailyDrill.skillId) : null;
  const drillCategory = drillSkillDef?.category ?? "technical";
  const drillCategoryIcon =
    drillCategory === "technical" ? "💻" : drillCategory === "behavioral" ? "🤝" : "🎙️";

  return (
    <div className="abh-home">
      <div className="abh-home-container">
        {/* Top Header / Welcome */}
        <header className="abh-home-hero">
          <h1 className="abh-home-title">Abhyas</h1>
          <p className="abh-home-subtitle">
            Private, deliberate interview practice. Canonical rubrics, grounded feedback, and
            realistic follow-ups entirely on your own terms.
          </p>
        </header>

        {/* First Time Guided Start State */}
        {isFirstTime ? (
          <section className="abh-home-first-time-card" aria-labelledby="first-time-heading">
            <div className="abh-home-first-time-header">
              <div style={{ flexShrink: 0 }}>
                <Mascot size="card" face="ready" alt="Abhyas pixel interviewer mascot" />
              </div>
              <div>
                <h2 id="first-time-heading" className="abh-home-first-time-title">
                  Welcome to Your Practice Studio
                </h2>
                <p className="abh-home-first-time-desc">
                  Zero telemetry, zero third-party proxies. Everything stays in your browser.
                </p>
              </div>
            </div>

            <div className="abh-home-steps">
              <div className="abh-home-step-item">
                <span className="abh-home-step-number">Step 1</span>
                <span className="abh-home-step-text">
                  Provide your Gemini or OpenAI API key in Settings (free tier works great).
                </span>
              </div>
              <div className="abh-home-step-item">
                <span className="abh-home-step-number">Step 2</span>
                <span className="abh-home-step-text">
                  Upload your resume or set your target experience level and role.
                </span>
              </div>
              <div className="abh-home-step-item">
                <span className="abh-home-step-number">Step 3</span>
                <span className="abh-home-step-text">
                  Complete simulated voice or text interviews and get honest, grounded feedback.
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                flexWrap: "wrap",
                marginTop: "var(--space-2)",
              }}
            >
              <Button variant="primary" onClick={onStartSession}>
                Start Your First Session
              </Button>
              {!hasProfile && onNavigateProfile && (
                <Button variant="secondary" onClick={onNavigateProfile}>
                  Upload Resume / Profile
                </Button>
              )}
              {onNavigateSettings && (
                <Button variant="ghost" onClick={onNavigateSettings}>
                  Configure Keys in Settings
                </Button>
              )}
            </div>
          </section>
        ) : (
          /* Returning User State: PG-14 Full */
          <>
            {/* Section 1: Daily Habit & Drill Row */}
            {streak && dailyDrill && (
              <section className="abh-home-habit-section" aria-label="Daily habit and practice">
                <div className="abh-home-habit-grid">
                  {/* Streak Card */}
                  <div className="abh-home-habit-card">
                    <div className="abh-home-habit-header">
                      <span className="abh-data-label">Daily Habit</span>
                      <span className="abh-form-hint">Best: {streak.longestStreak}d</span>
                    </div>

                    <div className="abh-home-streak-display">
                      <span className="abh-home-streak-num">
                        {streak.currentStreak > 0 ? `🔥 ${streak.currentStreak}` : "🌱 0"}
                      </span>
                      <span className="abh-home-streak-label">
                        {streak.currentStreak === 1
                          ? "Day streak"
                          : streak.currentStreak > 1
                            ? "Days streak"
                            : "Start your streak"}
                      </span>
                    </div>

                    <div className="abh-home-habit-pills">
                      <span className="abh-badge-muted">
                        🛡️ {streak.freezesAvailable} freeze
                        {streak.freezesAvailable === 1 ? "" : "s"} left
                      </span>
                      <span className="abh-badge-muted">🛋️ Weekends off</span>
                      {streak.todayPracticed && (
                        <span className="abh-badge abh-badge-strong">Practiced today ✓</span>
                      )}
                    </div>

                    <div>
                      <Progress
                        label={`Weekly goal: ${streak.weeklyProgress.completedDays}/${streak.weeklyProgress.target} days`}
                        value={Math.min(
                          100,
                          (streak.weeklyProgress.completedDays / streak.weeklyProgress.target) * 100
                        )}
                      />
                    </div>
                  </div>

                  {/* Today's Daily Drill Card */}
                  <div className="abh-home-daily-card">
                    <div className="abh-home-daily-header">
                      <div>
                        <span className="abh-data-label">Today&apos;s Daily Drill</span>
                        <h2 className="abh-home-daily-title">
                          {drillSkillDef?.name || "System Design & Architecture"}
                        </h2>
                      </div>
                      <span
                        className="abh-badge-muted"
                        style={{ color: `var(--cat-${drillCategory})` }}
                      >
                        {drillCategoryIcon} {drillCategory.toUpperCase()}
                      </span>
                    </div>

                    <p className="abh-home-daily-desc">
                      {dailyDrill.reason === "weakest_calibrated"
                        ? `Targets your calibrated weakest skill (${dailyDrill.score}% score). 5 questions · ~10 mins.`
                        : dailyDrill.reason === "uncalibrated_focus"
                          ? `Focus area based on preliminary practice (${dailyDrill.score}% score). 5 questions · ~10 mins.`
                          : "Recommended bite-sized practice to establish your calibration baseline. 5 questions · ~10 mins."}
                    </p>

                    <div className="abh-home-daily-footer">
                      {dailyDrill.isCompletedToday ? (
                        <>
                          <span className="abh-badge abh-badge-strong">Completed today ✓</span>
                          {onStartDailyDrill && (
                            <Button
                              variant="secondary"
                              onClick={() => onStartDailyDrill(dailyDrill.skillId)}
                            >
                              Practice Again
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="abh-badge-muted">Ready · Quick-fire</span>
                          {onStartDailyDrill && (
                            <Button
                              variant="primary"
                              onClick={() => onStartDailyDrill(dailyDrill.skillId)}
                            >
                              Start Today&apos;s Drill
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Section 2: Full Session Start Action Banner */}
            <section className="abh-home-action-banner" aria-labelledby="start-practice-heading">
              <div className="abh-home-action-text">
                <h2 id="start-practice-heading" className="abh-home-action-title">
                  Ready for a Full Interview?
                </h2>
                <p className="abh-home-action-subtitle">
                  Practice with adaptive follow-up questioning, rubric calibration, and grounded
                  feedback.
                </p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Button variant="primary" onClick={onStartSession}>
                  Start Full Session
                </Button>
                {onNavigateSkills && (
                  <Button variant="secondary" onClick={onNavigateSkills}>
                    Skills Dashboard
                  </Button>
                )}
              </div>
            </section>

            {/* Section 3: Recent Practice Sessions */}
            <section className="abh-panel" aria-labelledby="recent-sessions-heading">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                }}
              >
                <div>
                  <h2 id="recent-sessions-heading" className="abh-panel-title">
                    Recent Practice Sessions
                  </h2>
                  <span className="abh-form-hint">
                    {sessions.length} session{sessions.length === 1 ? "" : "s"} recorded
                  </span>
                </div>
                {onNavigateHistory && (
                  <Button variant="ghost" onClick={onNavigateHistory}>
                    View All in History →
                  </Button>
                )}
              </div>

              <div className="abh-recent-sessions-list" style={{ marginTop: "var(--space-3)" }}>
                {summaries.slice(0, 5).map(({ session, turnsCount, overallScore, targetRole }) => {
                  const dateStr = new Date(session.startedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedLevel =
                    session.level.charAt(0).toUpperCase() +
                    session.level.slice(1).replace(/_/g, " ");

                  return (
                    <article
                      key={session.id}
                      className="abh-recent-session-card"
                      aria-label={`Session from ${dateStr} for ${targetRole}`}
                    >
                      <div className="abh-recent-session-info">
                        <div className="abh-recent-session-meta">
                          <span className="abh-recent-session-role">{targetRole}</span>
                          <span className="abh-badge-muted">{formattedLevel}</span>
                          <span className="abh-badge-muted">
                            {session.modality === "voice" ? "🎙 Voice" : "⌨ Text"}
                          </span>
                        </div>
                        <div className="abh-recent-session-details">
                          <span className="abh-recent-session-date">{dateStr}</span>
                          <span>·</span>
                          <span>
                            {turnsCount} question{turnsCount === 1 ? "" : "s"}
                          </span>
                          {session.status !== "completed" && (
                            <>
                              <span>·</span>
                              <span style={{ color: "var(--accent-text)" }}>
                                {session.status === "active" ? "In Progress" : "Ended Early"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="abh-recent-session-actions">
                        {overallScore !== null && (
                          <div
                            className="abh-recent-session-score"
                            aria-label={`Score: ${overallScore} out of 100`}
                          >
                            <span>{overallScore}</span>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                              /100
                            </span>
                          </div>
                        )}
                        <Button variant="secondary" onClick={() => onViewResults(session.id)}>
                          View Results
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
