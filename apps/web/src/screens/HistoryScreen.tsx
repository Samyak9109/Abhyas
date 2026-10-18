// FR-019, design.md 8 (PG-17): History and session detail screen.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeSessionScorecard,
  deleteSession,
  generateGroundedRewrite,
  type GroundedRewrite,
  type QuarantineRow,
  type SessionRow,
  type SessionScorecard,
  type StorageAdapter,
  type StructuredProfile,
  type TurnRow,
} from "@abhyas/core";
import {
  Button,
  Callout,
  Dialog,
  Disclosure,
  Input,
  Mascot,
  Progress,
  Skeleton,
  Tabs,
  Toast,
} from "../components";

interface HistoryScreenProps {
  storage: StorageAdapter;
  initialSessionId?: string | null;
  onSelectSession?: (sessionId: string | null) => void;
  onStartSession?: () => void;
  onPracticeSkill?: (skillId: string) => void;
  onRetryQuestion?: (questionId: string) => void;
}

interface SessionListItem {
  session: SessionRow;
  overallScore: number | null;
  turnsCount: number;
  scoredTurnsCount: number;
  targetRole: string;
  isDrill: boolean;
  isBasicFeedback: boolean;
  targetSkillId?: string | undefined;
  drillFormat?: "quick_fire" | "deep_dive" | undefined;
  interviewType: string;
}

const PAGE_SIZE = 25;

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  storage,
  initialSessionId = null,
  onSelectSession,
  onStartSession,
  onPracticeSkill,
  onRetryQuestion,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [profiles, setProfiles] = useState<StructuredProfile[]>([]);
  const [quarantined, setQuarantined] = useState<QuarantineRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSessionId);
  const [sessionToDelete, setSessionToDelete] = useState<SessionRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [modalityFilter, setModalityFilter] = useState<"all" | "voice" | "text">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "interview" | "drill">("all");
  const [scoreFilter, setScoreFilter] = useState<"all" | "strong" | "developing" | "needs_work">(
    "all"
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "score_high" | "score_low">(
    "newest"
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Detail view state
  const [selectedTab, setSelectedTab] = useState("scorecard");
  const [rewrites, setRewrites] = useState<Record<string, GroundedRewrite>>({});
  const [loadingRewrites, setLoadingRewrites] = useState<Record<string, boolean>>({});

  // Sync initialSessionId
  useEffect(() => {
    if (initialSessionId !== undefined) {
      setSelectedSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allSessions, allTurns, allProfiles, allQuarantine] = await Promise.all([
        storage.getAll<SessionRow>("sessions"),
        storage.getAll<TurnRow>("turns"),
        storage.getAll<StructuredProfile>("structuredProfiles"),
        storage.getAll<QuarantineRow>("quarantine"),
      ]);

      setSessions(allSessions);
      setTurns(allTurns);
      setProfiles(allProfiles);
      setQuarantined(allQuarantine.filter((q) => q.table === "sessions" || q.table === "turns"));
    } catch (err) {
      console.error("Failed to load history data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Map turns by sessionId for quick lookup
  const turnsBySession = useMemo(() => {
    const map = new Map<string, TurnRow[]>();
    for (const turn of turns) {
      const list = map.get(turn.sessionId) || [];
      list.push(turn);
      map.set(turn.sessionId, list);
    }
    return map;
  }, [turns]);

  // Compute lightweight list items
  const sessionListItems: SessionListItem[] = useMemo(() => {
    return sessions.map((session) => {
      const sessionTurns = turnsBySession.get(session.id) || [];
      const scoredTurns = sessionTurns.filter((t) => t.status === "scored" && t.evaluation);
      let overallScore: number | null = null;
      if (scoredTurns.length > 0) {
        const sum = scoredTurns.reduce((acc, t) => {
          const c = t.evaluation?.criteria;
          if (!c) return acc;
          const turnAvg =
            (c.relevance.score +
              c.structure.score +
              c.depth.score +
              c.clarity.score +
              c.levelFit.score) /
            5;
          return acc + ((turnAvg - 1) / 4) * 100;
        }, 0);
        overallScore = Math.round(sum / scoredTurns.length);
      }

      const plan = session.plan as
        | {
            isDrill?: boolean;
            targetSkillId?: string;
            drillFormat?: "quick_fire" | "deep_dive";
            interviewType?: string;
            targetRole?: string;
          }
        | null
        | undefined;

      const isDrill = Boolean(plan?.isDrill);
      const targetRole = plan?.targetRole || "Software Engineer";
      const interviewType = isDrill
        ? plan?.drillFormat === "quick_fire"
          ? "Quick-Fire Drill"
          : "Deep-Dive Drill"
        : plan?.interviewType
          ? plan.interviewType.charAt(0).toUpperCase() + plan.interviewType.slice(1)
          : "Interview";

      const isBasicFeedback =
        session.providerId === "webllm" || sessionTurns.some((t) => t.evaluation?.isBasic === true);

      return {
        session,
        overallScore,
        turnsCount: sessionTurns.length,
        scoredTurnsCount: scoredTurns.length,
        targetRole,
        isDrill,
        isBasicFeedback,
        targetSkillId: plan?.targetSkillId,
        drillFormat: plan?.drillFormat,
        interviewType,
      };
    });
  }, [sessions, turnsBySession]);

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    return sessionListItems
      .filter((item) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const roleMatch = item.targetRole.toLowerCase().includes(q);
          const skillMatch = item.targetSkillId?.toLowerCase().includes(q);
          const typeMatch = item.interviewType.toLowerCase().includes(q);
          const sessionTurns = turnsBySession.get(item.session.id) || [];
          const questionMatch = sessionTurns.some((t) => t.questionText.toLowerCase().includes(q));
          if (!roleMatch && !skillMatch && !typeMatch && !questionMatch) {
            return false;
          }
        }

        // Modality
        if (modalityFilter !== "all" && item.session.modality !== modalityFilter) {
          return false;
        }

        // Type
        if (typeFilter === "interview" && item.isDrill) return false;
        if (typeFilter === "drill" && !item.isDrill) return false;

        // Score band
        if (scoreFilter !== "all") {
          if (item.overallScore === null) return false;
          if (scoreFilter === "strong" && item.overallScore < 75) return false;
          if (scoreFilter === "developing" && (item.overallScore < 50 || item.overallScore >= 75)) {
            return false;
          }
          if (scoreFilter === "needs_work" && item.overallScore >= 50) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === "newest") {
          return new Date(b.session.startedAt).getTime() - new Date(a.session.startedAt).getTime();
        }
        if (sortOrder === "oldest") {
          return new Date(a.session.startedAt).getTime() - new Date(b.session.startedAt).getTime();
        }
        if (sortOrder === "score_high") {
          return (b.overallScore ?? -1) - (a.overallScore ?? -1);
        }
        if (sortOrder === "score_low") {
          return (a.overallScore ?? 101) - (b.overallScore ?? 101);
        }
        return 0;
      });
  }, [
    sessionListItems,
    searchQuery,
    modalityFilter,
    typeFilter,
    scoreFilter,
    sortOrder,
    turnsBySession,
  ]);

  // Selected session detail data
  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    return sessions.find((s) => s.id === selectedSessionId) ?? null;
  }, [sessions, selectedSessionId]);

  const selectedTurns = useMemo(() => {
    if (!selectedSessionId) return [];
    const t = turnsBySession.get(selectedSessionId) || [];
    return [...t].sort((a, b) => a.index - b.index);
  }, [turnsBySession, selectedSessionId]);

  const selectedScorecard: SessionScorecard | null = useMemo(() => {
    if (!selectedSession) return null;
    return computeSessionScorecard(selectedSession, selectedTurns, profiles[0] ?? null);
  }, [selectedSession, selectedTurns, profiles]);

  const handleSelectSession = (id: string | null) => {
    setSelectedSessionId(id);
    onSelectSession?.(id ?? "");
  };

  const handleDeleteSessionConfirm = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteSession(storage, sessionToDelete.id);
      setToast("Session permanently deleted from history.");
      setSessionToDelete(null);
      if (selectedSessionId === sessionToDelete.id) {
        handleSelectSession(null);
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete session:", err);
      setToast("Failed to delete session. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLoadRewrite = useCallback(
    async (turn: TurnRow) => {
      if (rewrites[turn.id] || loadingRewrites[turn.id] || !selectedSession) return;
      setLoadingRewrites((prev) => ({ ...prev, [turn.id]: true }));

      try {
        const plan = selectedSession.plan as { targetRole?: string } | null;
        const result = await generateGroundedRewrite({
          questionText: turn.questionText,
          originalAnswer: turn.answerText,
          level: selectedSession.level,
          targetRole: plan?.targetRole || "Software Engineer",
          profile: profiles[0] ?? null,
        });
        setRewrites((prev) => ({ ...prev, [turn.id]: result }));
      } catch (err) {
        console.error("Failed to generate rewrite:", err);
      } finally {
        setLoadingRewrites((prev) => ({ ...prev, [turn.id]: false }));
      }
    },
    [rewrites, loadingRewrites, selectedSession, profiles]
  );

  const formatLevel = (lvl: string) => {
    return lvl.charAt(0).toUpperCase() + lvl.slice(1).replace(/_/g, " ");
  };

  const formatScoreBadge = (score: number | null) => {
    if (score === null) {
      return <span className="abh-badge abh-badge-muted">Unscored</span>;
    }
    if (score >= 75) {
      return <span className="abh-badge abh-badge-strong">{score}% Strong</span>;
    }
    if (score >= 50) {
      return <span className="abh-badge abh-badge-developing">{score}% Developing</span>;
    }
    return <span className="abh-badge abh-badge-needs-work">{score}% Needs work</span>;
  };

  const getTargetBenchmark = (level: string): number => {
    switch (level) {
      case "intern_fresher":
        return 60;
      case "junior":
        return 65;
      case "mid":
        return 70;
      case "senior":
        return 75;
      case "staff_plus":
        return 80;
      default:
        return 70;
    }
  };

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="abh-history-screen" aria-busy="true" aria-label="Loading history">
        <Skeleton height="36px" width="240px" />
        <Skeleton height="20px" width="380px" />
        <div style={{ marginTop: "var(--space-4)" }}>
          <Skeleton height="80px" />
          <div style={{ marginTop: "var(--space-3)" }}>
            <Skeleton height="80px" />
          </div>
          <div style={{ marginTop: "var(--space-3)" }}>
            <Skeleton height="80px" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Detail View
  if (selectedSession && selectedScorecard) {
    const isDrill = Boolean((selectedSession.plan as { isDrill?: boolean })?.isDrill);
    const targetSkill = (selectedSession.plan as { targetSkillId?: string })?.targetSkillId;
    const benchmark = getTargetBenchmark(selectedSession.level);

    const scorecardContent = (
      <div className="abh-results-tab-content" style={{ marginTop: "var(--space-4)" }}>
        {/* Basic Feedback Honesty Notice (FR-012, AI-014, PG-17) */}
        {selectedScorecard.isBasicFeedback && (
          <div style={{ marginBottom: "var(--space-4)" }}>
            <Callout variant="info" title="Basic Feedback Mode">
              Feedback for this session was computed using deterministic rule-based checks and a
              simplified rubric suited for local models. Scores reflect answer length, structural
              STAR markers, and keyword specificity.
            </Callout>
          </div>
        )}

        {/* Score Overview Panel */}
        <section className="abh-panel" aria-labelledby="detail-score-heading">
          <h2 id="detail-score-heading" className="abh-panel-title">
            Session Score &amp; Calibration
          </h2>
          <div className="abh-results-score-row">
            <div className="abh-results-big-score">
              <span className="abh-results-score-numeral">{selectedScorecard.overallScore}%</span>
              <span className="abh-results-score-sublabel">
                Benchmark: {benchmark}% ({formatLevel(selectedSession.level)})
              </span>
            </div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <Progress label="Overall session score" value={selectedScorecard.overallScore} />
            </div>
          </div>

          {/* Top 3 Priority Fixes */}
          {selectedScorecard.topThreeFixes.length > 0 && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <p className="abh-data-label" style={{ marginBottom: "var(--space-2)" }}>
                Top Priority Focus Areas
              </p>
              <ul className="abh-fixes-list">
                {selectedScorecard.topThreeFixes.map((fix, idx) => (
                  <li key={idx} className="abh-fix-item">
                    <span className="abh-fix-number">0{idx + 1}</span>
                    <span className="abh-fix-text">{fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Criteria Averages */}
          <div style={{ marginTop: "var(--space-4)" }}>
            <p className="abh-data-label" style={{ marginBottom: "var(--space-2)" }}>
              Rubric Criteria Breakdown
            </p>
            <div className="abh-criteria-grid">
              {selectedScorecard.criterionAverages.map((crit) => (
                <div key={crit.key} className="abh-criterion-card">
                  <div className="abh-criterion-header">
                    <span className="abh-criterion-name">{crit.name}</span>
                    <span className="abh-criterion-score">{crit.score.toFixed(1)} / 5</span>
                  </div>
                  <Progress label={`${crit.name} criterion score`} value={crit.percentage} />
                </div>
              ))}
            </div>
          </div>

          {/* Delivery metrics for voice */}
          {selectedScorecard.deliveryAverages && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <p className="abh-data-label" style={{ marginBottom: "var(--space-2)" }}>
                Speech &amp; Delivery Metrics
              </p>
              <div className="abh-delivery-grid">
                <div className="abh-delivery-item">
                  <span className="abh-data-value">
                    {Math.round(selectedScorecard.deliveryAverages.averageWordsPerMinute)} WPM
                  </span>
                  <span className="abh-data-label">Pacing</span>
                </div>
                <div className="abh-delivery-item">
                  <span className="abh-data-value">
                    {selectedScorecard.deliveryAverages.totalFillerWordCount}
                  </span>
                  <span className="abh-data-label">Filler Words</span>
                </div>
                <div className="abh-delivery-item">
                  <span className="abh-data-value">
                    {selectedScorecard.deliveryAverages.totalPauseSeconds.toFixed(1)}s
                  </span>
                  <span className="abh-data-label">Total Pause</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Questions List & Replay */}
        <section
          className="abh-panel"
          style={{ marginTop: "var(--space-4)" }}
          aria-labelledby="questions-replay-heading"
        >
          <h2 id="questions-replay-heading" className="abh-panel-title">
            Questions, Answers &amp; Feedback
          </h2>
          <p className="abh-panel-helper">
            Expand each question to review your answer, rubric rationales, and generate verifiable
            grounded rewrites.
          </p>

          <div className="abh-questions-list">
            {selectedTurns.map((turn, index) => {
              const evalData = turn.evaluation;
              let turnScore = 0;
              if (evalData) {
                const c = evalData.criteria;
                const avg =
                  (c.relevance.score +
                    c.structure.score +
                    c.depth.score +
                    c.clarity.score +
                    c.levelFit.score) /
                  5;
                turnScore = Math.round(((avg - 1) / 4) * 100);
              }
              const isMissed = evalData && turnScore < 60;
              const rewrite = rewrites[turn.id];

              return (
                <div key={turn.id} className="abh-question-item">
                  <Disclosure summary={turn.questionText}>
                    <div className="abh-turn-detail">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "var(--space-2)",
                        }}
                      >
                        <span className="abh-question-idx">Question 0{index + 1}</span>
                        {evalData && (
                          <span
                            className={`abh-badge ${turnScore >= 75 ? "abh-badge-strong" : turnScore >= 50 ? "abh-badge-developing" : "abh-badge-needs-work"}`}
                          >
                            {turnScore}% Score
                          </span>
                        )}
                      </div>
                      {/* Skill tags */}
                      <div className="abh-tag-pills" style={{ marginBottom: "var(--space-2)" }}>
                        {turn.skillTags.map((tag) => (
                          <span key={tag} className="abh-badge-muted">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Candidate Answer */}
                      <div className="abh-answer-block">
                        <p className="abh-data-label">Your Answer:</p>
                        <p className="abh-answer-text">
                          {turn.answerText || <em>(No answer recorded)</em>}
                        </p>
                      </div>

                      {/* Evaluation & feedback */}
                      {evalData && (
                        <div className="abh-eval-feedback">
                          <p className="abh-data-label">Criteria Evaluation:</p>
                          <ul style={{ margin: "var(--space-1) 0", paddingLeft: "var(--space-4)" }}>
                            {Object.entries(evalData.criteria).map(([critKey, critVal]) => (
                              <li key={critKey} style={{ marginBottom: "var(--space-2)" }}>
                                <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                                  {critKey}:{" "}
                                </span>
                                <span>
                                  {critVal.score}/5 — {critVal.reason}
                                </span>
                                {critVal.evidence && (
                                  <div className="abh-form-hint">
                                    Evidence: &ldquo;{critVal.evidence}&rdquo;
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>

                          {evalData.topFix && (
                            <div style={{ marginTop: "var(--space-2)" }}>
                              <Callout variant="info" title="Top Recommendation">
                                {evalData.topFix}
                              </Callout>
                            </div>
                          )}

                          {/* Grounded rewrite */}
                          <div style={{ marginTop: "var(--space-3)" }}>
                            {rewrite ? (
                              <div className="abh-rewrite-card">
                                <p className="abh-data-label">Grounded Rewrite:</p>
                                <p className="abh-rewrite-text">{rewrite.rewrittenAnswer}</p>
                                <p className="abh-form-hint">
                                  Why it works: {rewrite.improvementSummary}
                                </p>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                isLoading={Boolean(loadingRewrites[turn.id])}
                                onClick={() => void handleLoadRewrite(turn)}
                              >
                                Generate Grounded Rewrite
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Missed question practice CTA */}
                      {isMissed && (
                        <div style={{ marginTop: "var(--space-3)" }}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              if (turn.questionId && onRetryQuestion) {
                                onRetryQuestion(turn.questionId);
                              } else if (turn.skillTags[0] && onPracticeSkill) {
                                onPracticeSkill(turn.skillTags[0]);
                              }
                            }}
                          >
                            🎯 Practice This Question / Skill
                          </Button>
                        </div>
                      )}
                    </div>
                  </Disclosure>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );

    const transcriptContent = (
      <div className="abh-results-tab-content" style={{ marginTop: "var(--space-4)" }}>
        <section className="abh-panel" aria-labelledby="dialogue-transcript-heading">
          <h2 id="dialogue-transcript-heading" className="abh-panel-title">
            Chronological Dialogue Transcript
          </h2>
          <div className="abh-transcript-stream">
            {selectedTurns.map((turn, i) => (
              <div key={turn.id} className="abh-transcript-pair">
                <div className="abh-transcript-line abh-transcript-interviewer">
                  <span className="abh-transcript-speaker">Interviewer (Q{i + 1})</span>
                  <p className="abh-transcript-text">{turn.questionText}</p>
                </div>
                <div className="abh-transcript-line abh-transcript-candidate">
                  <span className="abh-transcript-speaker">Candidate</span>
                  <p className="abh-transcript-text">
                    {turn.answerText || <em>(No answer recorded)</em>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );

    return (
      <div className="abh-history-screen">
        <div className="abh-history-detail-header">
          <Button
            variant="ghost"
            onClick={() => handleSelectSession(null)}
            aria-label="Back to history session list"
          >
            ← Back to History
          </Button>

          <div className="abh-history-detail-title-row">
            <div>
              <h1 className="abh-app-title" style={{ margin: 0 }}>
                {isDrill
                  ? `Skill Drill: ${targetSkill?.replace(/_/g, " ").toUpperCase()}`
                  : `${(selectedSession.plan as { targetRole?: string })?.targetRole || "Interview"} Session`}
              </h1>
              <p className="abh-panel-helper">
                {new Date(selectedSession.startedAt).toLocaleString()} ·{" "}
                {formatLevel(selectedSession.level)} ·{" "}
                {selectedSession.modality === "voice" ? "🎙️ Voice" : "⌨️ Text"}
                {selectedScorecard.isBasicFeedback && (
                  <span
                    className="abh-badge--basic-feedback"
                    style={{ marginLeft: "var(--space-2)" }}
                  >
                    Basic Feedback
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {formatScoreBadge(selectedScorecard.overallScore)}
              {isDrill && targetSkill && onPracticeSkill && (
                <Button variant="secondary" onClick={() => onPracticeSkill(targetSkill)}>
                  Practice Drill Again
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setSessionToDelete(selectedSession)}
                aria-label="Delete this session from history"
              >
                Delete…
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs: Scorecard & Breakdown vs Full Transcript */}
        <div style={{ marginTop: "var(--space-4)" }}>
          <Tabs
            items={[
              { id: "scorecard", label: "Scorecard & Feedback", content: scorecardContent },
              { id: "transcript", label: "Full Transcript", content: transcriptContent },
            ]}
            selectedId={selectedTab}
            onSelect={setSelectedTab}
            ariaLabel="Session Detail Navigation"
          />
        </div>

        {/* Delete Dialog */}
        <Dialog
          isOpen={sessionToDelete !== null}
          onClose={() => setSessionToDelete(null)}
          title="Delete session from history?"
          actions={
            <>
              <Button variant="secondary" onClick={() => setSessionToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={isDeleting}
                onClick={() => void handleDeleteSessionConfirm()}
              >
                Delete session
              </Button>
            </>
          }
        >
          <p>
            This permanently removes this session and all its {selectedTurns.length} recorded
            answers from your local browser history. Your skill statistics will be updated
            automatically.
          </p>
        </Dialog>

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    );
  }

  // 3. List View (Empty or Filtered)
  return (
    <div className="abh-history-screen">
      <div className="abh-screen-header">
        <div>
          <h1 className="abh-app-title">History &amp; Transcripts</h1>
          <p className="abh-panel-helper">
            Revisit past mock interviews and practice drills, inspect scored answers, and track your
            progress.
          </p>
        </div>
        <span className="abh-badge-muted">
          {sessions.length} session{sessions.length === 1 ? "" : "s"} recorded
        </span>
      </div>

      {/* Corrupt session notice (FR-019 error case) */}
      {quarantined.length > 0 && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Callout variant="warning" title="Corrupt session records quarantined">
            {quarantined.length} corrupted session or turn record(s) were safely moved to quarantine
            to preserve your storage integrity.
          </Callout>
        </div>
      )}

      {/* Empty State when 0 total sessions */}
      {sessions.length === 0 ? (
        <section className="abh-panel abh-history-empty" aria-label="No sessions recorded yet">
          <div className="abh-empty-mascot-container">
            <Mascot size="card" />
          </div>
          <h2 className="abh-empty-title">No Practice Sessions Yet</h2>
          <p className="abh-empty-desc">
            Your completed mock interviews and skill practice drills will appear here with question
            transcripts, performance scores, and actionable feedback.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button variant="primary" onClick={onStartSession}>
              Start Your First Session
            </Button>
          </div>
        </section>
      ) : (
        <>
          {/* Filters Bar */}
          <section className="abh-history-filters-bar" aria-label="Session filters">
            <div className="abh-history-search-row">
              <Input
                label="Search Sessions"
                placeholder="Search by question, role, skill or type…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="abh-history-filter-pills">
              {/* Modality Filter */}
              <div className="abh-filter-group" role="group" aria-label="Modality filter">
                <span className="abh-filter-label">Modality:</span>
                <button
                  type="button"
                  className={`abh-filter-btn ${modalityFilter === "all" ? "active" : ""}`}
                  onClick={() => setModalityFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${modalityFilter === "voice" ? "active" : ""}`}
                  onClick={() => setModalityFilter("voice")}
                >
                  🎙️ Voice
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${modalityFilter === "text" ? "active" : ""}`}
                  onClick={() => setModalityFilter("text")}
                >
                  ⌨️ Text
                </button>
              </div>

              {/* Type Filter */}
              <div className="abh-filter-group" role="group" aria-label="Type filter">
                <span className="abh-filter-label">Type:</span>
                <button
                  type="button"
                  className={`abh-filter-btn ${typeFilter === "all" ? "active" : ""}`}
                  onClick={() => setTypeFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${typeFilter === "interview" ? "active" : ""}`}
                  onClick={() => setTypeFilter("interview")}
                >
                  🎙️ Interview
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${typeFilter === "drill" ? "active" : ""}`}
                  onClick={() => setTypeFilter("drill")}
                >
                  🎯 Skill Drill
                </button>
              </div>

              {/* Score Band Filter */}
              <div className="abh-filter-group" role="group" aria-label="Score band filter">
                <span className="abh-filter-label">Score:</span>
                <button
                  type="button"
                  className={`abh-filter-btn ${scoreFilter === "all" ? "active" : ""}`}
                  onClick={() => setScoreFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${scoreFilter === "strong" ? "active" : ""}`}
                  onClick={() => setScoreFilter("strong")}
                >
                  Strong (≥75%)
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${scoreFilter === "developing" ? "active" : ""}`}
                  onClick={() => setScoreFilter("developing")}
                >
                  Developing (50–74%)
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${scoreFilter === "needs_work" ? "active" : ""}`}
                  onClick={() => setScoreFilter("needs_work")}
                >
                  Needs work (&lt;50%)
                </button>
              </div>

              {/* Sort Order */}
              <div className="abh-filter-group" role="group" aria-label="Sort order">
                <span className="abh-filter-label">Sort:</span>
                <button
                  type="button"
                  className={`abh-filter-btn ${sortOrder === "newest" ? "active" : ""}`}
                  onClick={() => setSortOrder("newest")}
                >
                  Newest
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${sortOrder === "oldest" ? "active" : ""}`}
                  onClick={() => setSortOrder("oldest")}
                >
                  Oldest
                </button>
                <button
                  type="button"
                  className={`abh-filter-btn ${sortOrder === "score_high" ? "active" : ""}`}
                  onClick={() => setSortOrder("score_high")}
                >
                  Highest Score
                </button>
              </div>
            </div>
          </section>

          {/* Session Cards List */}
          {filteredSessions.length === 0 ? (
            <div className="abh-panel" style={{ textAlign: "center", padding: "var(--space-8)" }}>
              <p className="abh-empty-title">No sessions match your active filters</p>
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchQuery("");
                    setModalityFilter("all");
                    setTypeFilter("all");
                    setScoreFilter("all");
                    setSortOrder("newest");
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="abh-history-list" role="feed" aria-label="Past sessions list">
              {filteredSessions.slice(0, visibleCount).map((item) => {
                const dateStr = new Date(item.session.startedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <article
                    key={item.session.id}
                    className="abh-history-card"
                    aria-label={`Session from ${dateStr} for ${item.targetRole}`}
                  >
                    <div className="abh-history-card-header">
                      <div className="abh-history-card-meta">
                        <span className="abh-history-card-role">{item.targetRole}</span>
                        <span className="abh-badge-muted">{formatLevel(item.session.level)}</span>
                        <span className="abh-badge-muted">
                          {item.session.modality === "voice" ? "🎙️ Voice" : "⌨️ Text"}
                        </span>
                        {item.isBasicFeedback && (
                          <span className="abh-badge--basic-feedback">Basic</span>
                        )}
                        {item.isDrill ? (
                          <span className="abh-drill-badge">
                            🎯 Drill: {item.targetSkillId || "Practice"}
                          </span>
                        ) : (
                          <span className="abh-badge-muted">{item.interviewType}</span>
                        )}
                      </div>
                      <div>{formatScoreBadge(item.overallScore)}</div>
                    </div>

                    <div className="abh-history-card-body">
                      <span className="abh-history-card-date">{dateStr}</span>
                      <span className="abh-history-card-details">
                        {item.turnsCount} question{item.turnsCount === 1 ? "" : "s"}
                        {item.session.status === "completed" ? " · Completed" : " · Partial"}
                      </span>
                    </div>

                    <div className="abh-history-card-actions">
                      <Button
                        variant="secondary"
                        onClick={() => handleSelectSession(item.session.id)}
                      >
                        View Transcript &amp; Scores →
                      </Button>
                      {item.isDrill && item.targetSkillId && onPracticeSkill && (
                        <Button
                          variant="ghost"
                          onClick={() => onPracticeSkill(item.targetSkillId!)}
                        >
                          Practice Again
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() => setSessionToDelete(item.session)}
                        aria-label={`Delete session ${item.session.id}`}
                      >
                        Delete…
                      </Button>
                    </div>
                  </article>
                );
              })}

              {/* Virtualized/Pagination: Load more button if > visibleCount */}
              {filteredSessions.length > visibleCount && (
                <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
                  <Button
                    variant="secondary"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  >
                    Show more sessions ({filteredSessions.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={sessionToDelete !== null}
        onClose={() => setSessionToDelete(null)}
        title="Delete session from history?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setSessionToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={() => void handleDeleteSessionConfirm()}
            >
              Delete session
            </Button>
          </>
        }
      >
        <p>
          This permanently removes this session and all its recorded answers from your local browser
          history. Your skill statistics will be updated automatically.
        </p>
      </Dialog>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};
