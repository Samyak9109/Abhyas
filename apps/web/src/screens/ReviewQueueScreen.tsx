// FR-028, design.md 8 (PG-23): Review Queue & Spaced Repetition screen.
// Manages daily review set of missed questions with growing intervals,
// daily cap enforcement, and 1-click drill launch.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  enrichReviewItems,
  getDailyReviewSet,
  SessionPlanSchema,
  type EnrichedReviewItem,
  type ReviewQueueRow,
  type SelectedQuestion,
  type SessionPlan,
  type StorageAdapter,
  type TurnRow,
} from "@abhyas/core";
import { Button, Callout, Skeleton } from "../components";

interface ReviewQueueScreenProps {
  storage: StorageAdapter;
  onStartReviewDrill?: ((plan: SessionPlan, questions: SelectedQuestion[]) => void) | undefined;
  onNavigatePractice?: (() => void) | undefined;
  onNavigateHome?: (() => void) | undefined;
}

export function ReviewQueueScreen({
  storage,
  onStartReviewDrill,
  onNavigatePractice,
  onNavigateHome,
}: ReviewQueueScreenProps) {
  const [loading, setLoading] = useState(true);
  const [queueItems, setQueueItems] = useState<ReviewQueueRow[]>([]);
  const [turnsMap, setTurnsMap] = useState<Map<string, TurnRow>>(new Map());
  const [activeTab, setActiveTab] = useState<"due" | "all">("due");

  // Load review queue and matching turns
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rows, allTurns] = await Promise.all([
        storage.getAll<ReviewQueueRow>("reviewQueue"),
        storage.getAll<TurnRow>("turns"),
      ]);

      const map = new Map<string, TurnRow>();
      for (const t of allTurns) {
        map.set(t.id, t);
      }

      setQueueItems(rows);
      setTurnsMap(map);
    } catch (err) {
      console.error("Failed to load review queue:", err);
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Enrich and calculate due set with daily cap of 10
  const { dueItems, upcomingItems, allEnriched } = useMemo(() => {
    const enriched = enrichReviewItems(queueItems, turnsMap);
    const dailyCappedRows = getDailyReviewSet(queueItems, { maxDailyCap: 10 });
    const dailyCappedIds = new Set(dailyCappedRows.map((r) => r.id));

    const due = enriched.filter((item) => dailyCappedIds.has(item.id));
    const upcoming = enriched.filter((item) => !item.isDue);

    return {
      dueItems: due,
      upcomingItems: upcoming,
      allEnriched: enriched,
    };
  }, [queueItems, turnsMap]);

  // Handle removing / marking mastered
  const handleRemove = async (itemId: string) => {
    try {
      await storage.delete("reviewQueue", itemId);
      setQueueItems((prev) => prev.filter((r) => r.id !== itemId));
    } catch (err) {
      console.error("Failed to delete review item:", err);
    }
  };

  // Launch review drill with due questions
  const handleStartReviewDrill = () => {
    if (!onStartReviewDrill || dueItems.length === 0) return;

    const questions: SelectedQuestion[] = dueItems.map((item, idx) => {
      const turn = item.turn;
      const text = turn?.questionText ?? "Review Question";
      const tags = turn?.skillTags && turn.skillTags.length > 0 ? turn.skillTags : ["general"];
      const diff = turn?.difficulty ?? 0.5;

      return {
        id: turn?.questionId ?? `review-q-${item.turnId}-${idx}`,
        bankId: turn?.questionId,
        isUnverified: turn?.isUnverifiedQuestion ?? false,
        skillTags: tags,
        difficulty: diff,
        text,
        originalText: text,
        rationale: `Spaced repetition review (interval: ${item.intervalDays}d)`,
      };
    });

    const planLength: 5 | 10 | 15 = questions.length <= 5 ? 5 : 10;

    const plan: SessionPlan = SessionPlanSchema.parse({
      sessionId: crypto.randomUUID(),
      type: "mixed",
      length: planLength,
      style: "standard",
      inputMode: "text",
      level: "mid",
      targetRole: "Software Engineer",
      createdAt: new Date().toISOString(),
      isDrill: true,
      targetSkillId: questions[0]?.skillTags[0] ?? "general",
    });

    onStartReviewDrill(plan, questions);
  };

  if (loading) {
    return (
      <div className="abh-review-screen" role="status" aria-label="Loading review queue">
        <Skeleton height="36px" />
        <Skeleton height="100px" />
        <Skeleton height="180px" />
      </div>
    );
  }

  return (
    <div className="abh-review-screen">
      <header className="abh-review-header">
        <div className="abh-review-title-row">
          <div>
            <h1 className="abh-review-title">Review Queue & Spaced Repetition</h1>
            <p className="abh-review-subtitle">
              Revisit questions you previously struggled with at growing intervals until you master
              them.
            </p>
          </div>
          {onNavigateHome && (
            <Button variant="ghost" onClick={onNavigateHome}>
              ← Back to Home
            </Button>
          )}
        </div>

        {/* Stats Row */}
        <div className="abh-review-stats-bar">
          <div className="abh-review-stat-pill">
            <span className="abh-review-stat-val">{dueItems.length}</span>
            <span className="abh-review-stat-lbl">Due Today</span>
          </div>
          <div className="abh-review-stat-pill">
            <span className="abh-review-stat-val">{queueItems.length}</span>
            <span className="abh-review-stat-lbl">Total in Queue</span>
          </div>
          <div className="abh-review-stat-pill abh-review-stat-pill--cap">
            <span className="abh-review-stat-val">10 / day</span>
            <span className="abh-review-stat-lbl">Daily Cap</span>
          </div>
        </div>
      </header>

      {/* Main Review Section */}
      <section className="abh-review-section" aria-labelledby="review-due-heading">
        <div className="abh-review-section-header">
          <div className="abh-review-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "due"}
              className={`abh-review-tab ${activeTab === "due" ? "abh-review-tab--active" : ""}`}
              onClick={() => setActiveTab("due")}
            >
              Due Today ({dueItems.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`abh-review-tab ${activeTab === "all" ? "abh-review-tab--active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All in Queue ({queueItems.length})
            </button>
          </div>

          {activeTab === "due" && dueItems.length > 0 && onStartReviewDrill && (
            <Button variant="primary" onClick={handleStartReviewDrill}>
              ⚡ Start Daily Review Drill ({dueItems.length})
            </Button>
          )}
        </div>

        {/* Tab 1: Due Today */}
        {activeTab === "due" && (
          <div className="abh-review-list">
            {dueItems.length === 0 ? (
              <div className="abh-review-empty" role="status">
                <Callout variant="info" title="All Caught Up!">
                  You have zero questions due for review today. As you practice and complete
                  interviews, questions where you scored below 70 will automatically appear here.
                </Callout>
                {upcomingItems.length > 0 && (
                  <p className="abh-review-upcoming-hint">
                    You have {upcomingItems.length} question
                    {upcomingItems.length === 1 ? "" : "s"} scheduled for upcoming review dates.
                  </p>
                )}
                {onNavigatePractice && (
                  <div style={{ marginTop: "var(--space-4)" }}>
                    <Button variant="secondary" onClick={onNavigatePractice}>
                      Practice New Questions →
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              dueItems.map((item) => (
                <ReviewItemCard
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemove(item.id)}
                  onPractice={handleStartReviewDrill}
                />
              ))
            )}
          </div>
        )}

        {/* Tab 2: All Queue Items */}
        {activeTab === "all" && (
          <div className="abh-review-list">
            {allEnriched.length === 0 ? (
              <div className="abh-review-empty">
                <p className="abh-text-muted">
                  Your spaced repetition review queue is completely empty. Weak questions from
                  interview sessions will be enqueued here automatically.
                </p>
              </div>
            ) : (
              allEnriched.map((item) => (
                <ReviewItemCard
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemove(item.id)}
                  onPractice={item.isDue ? handleStartReviewDrill : undefined}
                />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface ReviewItemCardProps {
  item: EnrichedReviewItem;
  onRemove: () => void;
  onPractice?: (() => void) | undefined;
}

function ReviewItemCard({ item, onRemove, onPractice }: ReviewItemCardProps) {
  const turn = item.turn;
  const score = item.pastScore;
  const topFix = turn?.evaluation?.topFix;
  const dueFormatted = new Date(item.dueAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <article
      className={`abh-review-card ${item.isDue ? "abh-review-card--due" : ""}`}
      aria-label={`Review question: ${turn?.questionText ?? item.turnId}`}
    >
      <div className="abh-review-card-top">
        <div className="abh-review-card-badges">
          {item.isDue ? (
            <span className="abh-review-status-badge abh-review-status-badge--due">
              {item.daysOverdue > 0 ? `Overdue (${item.daysOverdue}d)` : "Due Today"}
            </span>
          ) : (
            <span className="abh-review-status-badge abh-review-status-badge--upcoming">
              Due {dueFormatted}
            </span>
          )}

          <span className="abh-review-interval-badge">Interval: {item.intervalDays}d</span>

          {score !== undefined && (
            <span className="abh-review-score-badge">Past Score: {score}/100</span>
          )}
        </div>

        <Button variant="ghost" onClick={onRemove} aria-label={`Remove question from review queue`}>
          Dismiss
        </Button>
      </div>

      <h2 className="abh-review-card-question">
        {turn?.questionText ?? "Question details not found"}
      </h2>

      {topFix && (
        <div className="abh-review-card-fix">
          <span className="abh-review-fix-label">Key Fix Needed:</span>
          <p className="abh-review-fix-text">{topFix}</p>
        </div>
      )}

      {turn?.skillTags && turn.skillTags.length > 0 && (
        <div className="abh-review-card-tags">
          {turn.skillTags.map((tag) => (
            <span key={tag} className="abh-badge-muted">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {onPractice && item.isDue && (
        <div className="abh-review-card-actions">
          <Button variant="secondary" onClick={onPractice}>
            Practice in Drill →
          </Button>
        </div>
      )}
    </article>
  );
}
