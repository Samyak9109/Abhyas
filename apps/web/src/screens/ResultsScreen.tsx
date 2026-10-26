// FR-012, FR-013, ADR-006, design.md 8 (PG-13): Session results and scorecard screen.
import { useCallback, useEffect, useState } from "react";
import {
  AnthropicAdapter,
  computeSessionScorecard,
  generateGroundedRewrite,
  GeminiAdapter,
  HuggingFaceAdapter,
  MockProviderAdapter,
  OllamaAdapter,
  OpenAICompatibleAdapter,
  syncSessionWeakTurnsToQueue,
  type GroundedRewrite,
  type ProviderAdapter,
  type ProviderRow,
  type SessionRow,
  type SessionScorecard,
  type SettingRow,
  type StorageAdapter,
  type StructuredProfile,
  type TurnRow,
} from "@abhyas/core";
import { Button, Callout, Disclosure, Progress, Skeleton, Tabs } from "../components";
import { getLocalEngineAdapter } from "../services/local-engine";
import { recomputeAndStoreSkillStats } from "../services/skills-recompute";

function createProviderFromRow(row: ProviderRow | null | undefined): ProviderAdapter | null {
  if (!row) return null;
  if (row.kind === "webllm") {
    return getLocalEngineAdapter();
  }
  if (row.kind === "mock") {
    return new MockProviderAdapter();
  }
  if (row.kind === "ollama") {
    return new OllamaAdapter({
      baseUrl: row.baseUrl || "http://localhost:11434",
      apiKey: row.key,
      model: row.modelRoles?.evaluator || row.modelRoles?.interviewer,
    });
  }
  // Cloud providers require a valid in-memory API key
  if (!row.key || row.key.trim().length === 0) {
    return null;
  }
  if (row.kind === "gemini") {
    return new GeminiAdapter({
      apiKey: row.key,
      ...(row.baseUrl ? { baseUrl: row.baseUrl } : {}),
    });
  }
  if (row.kind === "anthropic") {
    return new AnthropicAdapter({
      apiKey: row.key,
      baseUrl: row.baseUrl || "https://api.anthropic.com/v1",
      model: row.modelRoles?.evaluator || row.modelRoles?.interviewer,
    });
  }
  if (row.kind === "huggingface") {
    return new HuggingFaceAdapter({
      apiKey: row.key,
      baseUrl: row.baseUrl || "https://api-inference.huggingface.co/v1",
      model: row.modelRoles?.evaluator || row.modelRoles?.interviewer,
    });
  }
  const openAiId = row.id === "openai" ? "openai" : "openai-compatible";
  return new OpenAICompatibleAdapter({
    id: openAiId,
    apiKey: row.key,
    baseUrl: row.baseUrl,
    allowCustomOrigin: true,
    model: row.modelRoles?.evaluator || row.modelRoles?.interviewer,
  });
}

interface ResultsScreenProps {
  storage: StorageAdapter;
  sessionId: string;
  provider?: ProviderAdapter | undefined;
  onRetryQuestion?: (questionId: string) => void;
  onPracticeSkill?: (skillId: string) => void;
  onNavigateSkills?: () => void;
  onFinish: () => void;
  onNavigateHome: () => void;
}

export function ResultsScreen({
  storage,
  sessionId,
  provider: propProvider,
  onRetryQuestion,
  onPracticeSkill,
  onNavigateSkills,
  onFinish,
  onNavigateHome,
}: ResultsScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionRow | null>(null);
  const [turns, setTurns] = useState<TurnRow[]>([]);
  const [profile, setProfile] = useState<StructuredProfile | null>(null);
  const [scorecard, setScorecard] = useState<SessionScorecard | null>(null);
  const [activeProvider, setActiveProvider] = useState<ProviderAdapter | null>(
    propProvider ?? null
  );
  const [rewrites, setRewrites] = useState<Record<string, GroundedRewrite>>({});
  const [loadingRewrites, setLoadingRewrites] = useState<Record<string, boolean>>({});
  const [selectedTab, setSelectedTab] = useState("scorecard");

  // Load session, turns, profile, and provider from storage
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setIsLoading(true);
        const [loadedSession, allTurns, allProfiles, activeSetting, allProviders] =
          await Promise.all([
            storage.get<SessionRow>("sessions", sessionId),
            storage.getAll<TurnRow>("turns"),
            storage.getAll<StructuredProfile>("structuredProfiles"),
            storage.get<SettingRow>("settings", "activeProviderId"),
            storage.getAll<ProviderRow>("providers"),
          ]);

        if (!active) return;

        if (propProvider) {
          setActiveProvider(propProvider);
        } else {
          const activeId = loadedSession?.providerId ?? activeSetting?.value ?? allProviders[0]?.id;
          const activeRow = allProviders.find((p) => p.id === activeId) ?? allProviders[0] ?? null;
          setActiveProvider(createProviderFromRow(activeRow));
        }

        if (loadedSession) {
          const sessionTurns = allTurns
            .filter((t) => t.sessionId === sessionId)
            .sort((a, b) => a.index - b.index);
          const activeProfile = allProfiles[0] ?? null;

          setSession(loadedSession);
          setTurns(sessionTurns);
          setProfile(activeProfile);

          const card = computeSessionScorecard(loadedSession, sessionTurns, activeProfile);
          setScorecard(card);

          // FR-014: Automatically update skill statistics cache in storage
          void recomputeAndStoreSkillStats(storage);

          // FR-028: Automatically enqueue any weak turns for spaced repetition review
          void syncSessionWeakTurnsToQueue(storage, sessionTurns);
        }
      } catch (err) {
        console.error("Failed to load interview results:", err);
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [storage, sessionId, propProvider]);

  // Generate grounded rewrite on demand for a turn
  const handleLoadRewrite = useCallback(
    async (turn: TurnRow) => {
      if (rewrites[turn.id] || loadingRewrites[turn.id] || !session) return;
      setLoadingRewrites((prev) => ({ ...prev, [turn.id]: true }));

      try {
        const result = await generateGroundedRewrite({
          questionText: turn.questionText,
          originalAnswer: turn.answerText,
          level: session.level,
          targetRole:
            typeof session.plan === "object" &&
            session.plan !== null &&
            "targetRole" in session.plan
              ? (session.plan as { targetRole: string }).targetRole
              : "Software Engineer",
          profile,
          provider: activeProvider ?? undefined,
        });
        setRewrites((prev) => ({ ...prev, [turn.id]: result }));
      } catch (err) {
        console.error("Failed to generate rewrite for turn", err);
      } finally {
        setLoadingRewrites((prev) => ({ ...prev, [turn.id]: false }));
      }
    },
    [rewrites, loadingRewrites, session, profile, activeProvider]
  );

  if (isLoading) {
    return (
      <div className="abh-results abh-results--calm" aria-busy="true" aria-label="Loading results">
        <div className="abh-results-container">
          <Skeleton height="32px" />
          <Skeleton height="120px" />
          <Skeleton height="240px" />
        </div>
      </div>
    );
  }

  if (!session || !scorecard) {
    return (
      <div className="abh-results abh-results--calm">
        <div className="abh-results-container">
          <Callout variant="danger" title="Session Not Found">
            The requested interview results could not be found in local browser storage.
          </Callout>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Button variant="primary" onClick={onNavigateHome}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Find the weakest question (lowest turn score)
  const scoredTurns = turns.filter((t) => t.status === "scored" && t.evaluation !== undefined);
  const weakestTurn = [...scoredTurns].sort((a, b) => {
    const cA = a.evaluation!.criteria;
    const cB = b.evaluation!.criteria;
    const sA =
      (cA.relevance.score +
        cA.structure.score +
        cA.depth.score +
        cA.clarity.score +
        cA.levelFit.score) /
      5;
    const sB =
      (cB.relevance.score +
        cB.structure.score +
        cB.depth.score +
        cB.clarity.score +
        cB.levelFit.score) /
      5;
    return sA - sB;
  })[0];

  // Weakest skill from summaries
  const weakestSkill = [...scorecard.skillSummaries].sort((a, b) => a.score - b.score)[0];

  // TAB 1 CONTENT: Scorecard & Feedback
  const scorecardContent = (
    <div className="abh-results-tab-content">
      {/* Top Three Fixes Section (design.md 8 PG-13) */}
      <section className="abh-panel abh-panel--accent" aria-labelledby="top-fixes-heading">
        <h2 id="top-fixes-heading" className="abh-panel-title">
          Top Priority Fixes
        </h2>
        <p className="abh-panel-desc">
          High-leverage improvements to focus on before your next interview:
        </p>
        <ol className="abh-top-fixes-list">
          {scorecard.topThreeFixes.map((fix, idx) => (
            <li key={idx} className="abh-top-fix-item">
              <span className="abh-top-fix-number">{idx + 1}</span>
              <span className="abh-top-fix-text">{fix}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Rubric Criterion Breakdown Bars */}
      <section className="abh-panel" aria-labelledby="criteria-heading">
        <h2 id="criteria-heading" className="abh-panel-title">
          Rubric Criteria Breakdown
        </h2>
        <div className="abh-criteria-grid">
          {scorecard.criterionAverages.map((crit) => (
            <div key={crit.key} className="abh-criterion-row">
              <div className="abh-criterion-meta">
                <span className="abh-criterion-name">{crit.name}</span>
                <span className="abh-criterion-score">{crit.score} / 5.0</span>
              </div>
              <Progress label={crit.name} value={crit.percentage} />
            </div>
          ))}
        </div>
      </section>

      {/* Delivery Metrics (Voice sessions only - omitted cleanly for text) */}
      {scorecard.deliveryAverages && (
        <section className="abh-panel" aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="abh-panel-title">
            Speech & Delivery Metrics
          </h2>
          <div className="abh-metrics-chips">
            <div className="abh-metric-chip">
              <span className="abh-metric-value">
                {scorecard.deliveryAverages.averageWordsPerMinute}
              </span>
              <span className="abh-metric-label">Words Per Minute</span>
            </div>
            <div className="abh-metric-chip">
              <span className="abh-metric-value">
                {scorecard.deliveryAverages.totalFillerWordCount}
              </span>
              <span className="abh-metric-label">Total Filler Words</span>
            </div>
            <div className="abh-metric-chip">
              <span className="abh-metric-value">
                {scorecard.deliveryAverages.totalPauseSeconds}s
              </span>
              <span className="abh-metric-label">Total Pause Time</span>
            </div>
            <div className="abh-metric-chip">
              <span className="abh-metric-value">
                {scorecard.deliveryAverages.averageAnswerWords}
              </span>
              <span className="abh-metric-label">Avg Answer Length</span>
            </div>
          </div>
        </section>
      )}

      {/* Skills Attributed */}
      {scorecard.skillSummaries.length > 0 && (
        <section className="abh-panel" aria-labelledby="skills-heading">
          <h2 id="skills-heading" className="abh-panel-title">
            Skills Evaluated
          </h2>
          <div className="abh-skills-summary-grid">
            {scorecard.skillSummaries.map((s) => (
              <div key={s.skillId} className="abh-skill-summary-card">
                <div className="abh-skill-header">
                  <span className="abh-skill-name">{s.skillId.replace(/_/g, " ")}</span>
                  <span className="abh-skill-score">{s.score}%</span>
                </div>
                <span className="abh-form-hint">
                  {s.answersCount} answer{s.answersCount === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // TAB 2 CONTENT: Per-Question Breakdown
  const breakdownContent = (
    <div className="abh-results-tab-content">
      <section className="abh-breakdown-section" aria-label="Question by question feedback">
        {turns.map((turn, idx) => {
          const evalData = turn.evaluation;
          const turnScore = evalData
            ? Math.round(
                ((evalData.criteria.relevance.score +
                  evalData.criteria.structure.score +
                  evalData.criteria.depth.score +
                  evalData.criteria.clarity.score +
                  evalData.criteria.levelFit.score) /
                  5 -
                  1) *
                  25
              )
            : 0;

          return (
            <div key={turn.id} className="abh-breakdown-card">
              <div className="abh-breakdown-header">
                <div>
                  <span className="abh-badge-muted">Question {idx + 1}</span>
                  <h3 className="abh-breakdown-question">{turn.questionText}</h3>
                  <div className="abh-breakdown-tags">
                    {turn.skillTags.map((tag) => (
                      <span key={tag} className="abh-tag-pill">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {turn.status === "scored" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    {turn.evaluation?.isBasic && (
                      <span className="abh-badge--basic-feedback">Basic</span>
                    )}
                    <div className="abh-turn-score-badge">
                      <span>{turnScore}%</span>
                    </div>
                  </div>
                ) : (
                  <span className="abh-badge-muted">Unscored</span>
                )}
              </div>

              <div className="abh-breakdown-answer">
                <strong>Your Answer:</strong>
                <p>{turn.answerText}</p>
              </div>

              {/* Turn Delivery (if voice) */}
              {turn.delivery && (
                <div className="abh-turn-delivery-stats">
                  <span>Pacing: {turn.delivery.wordsPerMinute} WPM</span>
                  <span>Fillers: {turn.delivery.fillerWordCount}</span>
                  <span>Pauses: {turn.delivery.pauseSeconds}s</span>
                </div>
              )}

              {/* Detailed Rubric Criteria & Evidence */}
              {evalData && (
                <div className="abh-turn-evaluation">
                  <Disclosure summary="View Rubric Evidence & Criteria Scores">
                    <div className="abh-criteria-detail-list">
                      {Object.entries(evalData.criteria).map(([key, crit]) => (
                        <div key={key} className="abh-criterion-detail">
                          <div className="abh-criterion-detail-header">
                            <strong style={{ textTransform: "capitalize" }}>{key}</strong>
                            <span>{crit.score} / 5</span>
                          </div>
                          <p className="abh-criterion-reason">{crit.reason}</p>
                          {crit.evidence && crit.evidence !== "None" && (
                            <blockquote className="abh-criterion-quote">
                              "{crit.evidence}"
                            </blockquote>
                          )}
                        </div>
                      ))}
                    </div>
                  </Disclosure>

                  {/* Top Fix Callout for this turn */}
                  {evalData.topFix && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <Callout variant="info" title="Top Recommendation">
                        {evalData.topFix}
                      </Callout>
                    </div>
                  )}

                  {/* Stronger Answer Section Grounded in Profile */}
                  <div className="abh-stronger-answer-box">
                    <div className="abh-stronger-header">
                      <strong>Stronger Answer (Grounded in Your Profile)</strong>
                      {!rewrites[turn.id] && (
                        <Button
                          variant="secondary"
                          onClick={() => void handleLoadRewrite(turn)}
                          isLoading={Boolean(loadingRewrites[turn.id])}
                        >
                          View Grounded Rewrite
                        </Button>
                      )}
                    </div>

                    {rewrites[turn.id] && (
                      <div className="abh-stronger-body">
                        <p className="abh-stronger-text">{rewrites[turn.id]!.rewrittenAnswer}</p>
                        <p className="abh-form-hint" style={{ marginTop: "var(--space-2)" }}>
                          <strong>Why this is stronger:</strong>{" "}
                          {rewrites[turn.id]!.improvementSummary}
                        </p>
                        {rewrites[turn.id]!.groundedFacts.length > 0 && (
                          <div className="abh-grounded-facts">
                            <span className="abh-form-hint">
                              Grounded in verified profile facts:{" "}
                              {rewrites[turn.id]!.groundedFacts.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {onRetryQuestion && turn.questionId && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <Button variant="ghost" onClick={() => onRetryQuestion(turn.questionId!)}>
                    Retry Question {idx + 1}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );

  // TAB 3 CONTENT: Full Transcript
  const transcriptContent = (
    <div className="abh-results-tab-content">
      <section className="abh-panel" aria-label="Session conversation transcript">
        <h2 className="abh-panel-title">Verbatim Interview Transcript</h2>
        <div className="abh-transcript-list">
          {turns.map((turn, idx) => (
            <div key={turn.id} className="abh-transcript-block">
              <div className="abh-transcript-q">
                <span className="abh-badge-speaker">Interviewer</span>
                <p>
                  <strong>Q{idx + 1}:</strong> {turn.questionText}
                </p>
              </div>
              <div className="abh-transcript-a">
                <span className="abh-badge-speaker">You</span>
                <p>{turn.answerText}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="abh-results abh-results--calm">
      <div className="abh-results-container">
        {/* Top Header */}
        <header className="abh-results-header">
          <div className="abh-results-header-text">
            <span className="abh-badge-muted" aria-label={`Modality: ${session.modality}`}>
              {session.modality === "voice" ? "🎙 Voice Session" : "⌨ Text Session"}
            </span>
            <h1 className="abh-results-title">Interview Scorecard</h1>
            <p className="abh-results-subtitle">
              Practiced at <strong>{session.level}</strong> level ·{" "}
              {new Date(session.startedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {scorecard.isBasicFeedback && (
                <span
                  className="abh-badge--basic-feedback"
                  style={{ marginLeft: "var(--space-2)" }}
                >
                  Basic Feedback
                </span>
              )}
            </p>
          </div>

          {/* Overall Score Chip */}
          <div
            className="abh-score-card"
            aria-label={`Overall score: ${scorecard.overallScore} out of 100`}
          >
            <span className="abh-score-card-number">{scorecard.overallScore}</span>
            <span className="abh-score-card-scale">/ 100</span>
            <span className="abh-score-card-caption">
              {scorecard.isBasicFeedback ? "Basic Score" : "Overall Score"}
            </span>
          </div>
        </header>

        {/* Basic Feedback Honesty Notice (FR-012, AI-014, PG-13) */}
        {scorecard.isBasicFeedback && (
          <div className="abh-results-banner">
            <Callout variant="info" title="Basic Feedback Mode">
              Feedback for this session was computed using deterministic rule-based checks and a
              simplified rubric suited for local models. Scores reflect answer length, structural
              STAR markers, and keyword specificity.
            </Callout>
          </div>
        )}

        {/* Partial Session Warning Banner */}
        {scorecard.isPartial && (
          <div className="abh-results-banner">
            <Callout variant="warning" title="Partial Session Notice">
              This session was ended early. Feedback and scores below are based on the{" "}
              {scorecard.scoredTurnsCount} completed answer
              {scorecard.scoredTurnsCount === 1 ? "" : "s"}.
            </Callout>
          </div>
        )}

        {/* Level Fit Suggestion Callout */}
        {scorecard.levelFitNote && (
          <div className="abh-results-banner">
            <Callout variant="info" title="Level Calibration Note">
              {scorecard.levelFitNote}
            </Callout>
          </div>
        )}

        {/* Resume-versus-Level Calibration Callout (FR-004, FR-017) */}
        {scorecard.resumeVersusLevelNote && (
          <div className="abh-results-banner">
            <Callout variant="info" title="Experience Calibration Note">
              {scorecard.resumeVersusLevelNote}
            </Callout>
          </div>
        )}

        {/* Tabs for Navigation */}
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Tabs
            items={[
              { id: "scorecard", label: "Scorecard & Feedback", content: scorecardContent },
              {
                id: "breakdown",
                label: `Per-Question (${turns.length})`,
                content: breakdownContent,
              },
              { id: "transcript", label: "Full Transcript", content: transcriptContent },
            ]}
            selectedId={selectedTab}
            onSelect={setSelectedTab}
            ariaLabel="Interview Results Navigation"
          />
        </div>

        {/* Bottom Actions Bar */}
        <footer className="abh-results-actions-bar">
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {onRetryQuestion && weakestTurn?.questionId && (
              <Button variant="secondary" onClick={() => onRetryQuestion(weakestTurn.questionId!)}>
                Retry Weakest Question
              </Button>
            )}
            {onPracticeSkill && weakestSkill && (
              <Button variant="secondary" onClick={() => onPracticeSkill(weakestSkill.skillId)}>
                Practice Weakest Skill ({weakestSkill.skillId.replace(/_/g, " ")})
              </Button>
            )}
            {onNavigateSkills && (
              <Button variant="secondary" onClick={onNavigateSkills}>
                Skills Dashboard
              </Button>
            )}
          </div>

          <Button variant="primary" onClick={onFinish}>
            Finish & Return Home
          </Button>
        </footer>
      </div>
    </div>
  );
}
