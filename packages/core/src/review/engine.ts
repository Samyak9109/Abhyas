// FR-028: Spaced repetition interval engine and daily review set logic.
import { calculateTurnScore } from "../evaluation/rubric-evaluator.js";
import type { ReviewQueueRow, TurnRow } from "../schemas/storage-rows.schema.js";
import type { StorageAdapter } from "../storage/index.js";
import type { EnrichedReviewItem, ReviewOptions } from "./types.js";

/**
 * Checks whether a turn is considered weak or missed and eligible for spaced repetition.
 * Returns true if score < threshold (default: 70) or any rubric criterion score is <= 2.
 */
export function isWeakTurn(turn: TurnRow, threshold = 70): boolean {
  if (turn.status !== "scored" || !turn.evaluation) {
    return false;
  }

  const score = calculateTurnScore(turn.evaluation);
  if (score < threshold) {
    return true;
  }

  const c = turn.evaluation.criteria;
  return (
    c.relevance.score <= 2 ||
    c.structure.score <= 2 ||
    c.depth.score <= 2 ||
    c.clarity.score <= 2 ||
    c.levelFit.score <= 2
  );
}

/**
 * Calculates the next review interval in days based on performance.
 * - Good answer (>= 70): interval expands (1 -> 3 -> 7 -> 14 -> 30 -> 60 -> 2x).
 * - Poor answer (< 70): interval resets to 1 day.
 */
export function calculateNextInterval(currentInterval: number, isGoodAnswer: boolean): number {
  if (!isGoodAnswer) {
    return 1;
  }

  if (currentInterval <= 1) return 3;
  if (currentInterval <= 3) return 7;
  if (currentInterval <= 7) return 14;
  if (currentInterval <= 14) return 30;
  if (currentInterval <= 30) return 60;
  return Math.round(currentInterval * 2);
}

/**
 * Creates a new ReviewQueueRow for a missed turn with an initial 1-day interval.
 */
export function createReviewItem(
  turnId: string,
  options: { intervalDays?: number | undefined; now?: Date | undefined } = {}
): ReviewQueueRow {
  const intervalDays = options.intervalDays ?? 1;
  const now = options.now ?? new Date();
  const dueAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `review-${turnId}`,
    turnId,
    intervalDays,
    dueAt,
  };
}

/**
 * Updates a ReviewQueueRow after the candidate answers it in review.
 */
export function processReviewOutcome(
  item: ReviewQueueRow,
  newScore: number,
  now: Date = new Date()
): ReviewQueueRow {
  const isGoodAnswer = newScore >= 70;
  const nextInterval = calculateNextInterval(item.intervalDays, isGoodAnswer);
  const nextDueAt = new Date(now.getTime() + nextInterval * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...item,
    intervalDays: nextInterval,
    dueAt: nextDueAt,
  };
}

/**
 * Filters and returns the daily review set respecting the daily cap.
 * Items due on or before referenceDate are sorted by most overdue first,
 * and capped at maxDailyCap (default: 10).
 */
export function getDailyReviewSet(
  items: ReviewQueueRow[],
  options: ReviewOptions = {}
): ReviewQueueRow[] {
  const maxDailyCap = options.maxDailyCap ?? 10;
  const refDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
  const refTime = refDate.getTime();

  // Find all items due on or before reference time
  const dueItems = items.filter((item) => new Date(item.dueAt).getTime() <= refTime);

  // Sort by most overdue first (earliest dueAt first)
  dueItems.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  // Cap at maxDailyCap
  return dueItems.slice(0, maxDailyCap);
}

/**
 * Enriches review items with joined turn data, past scores, and overdue calculations.
 */
export function enrichReviewItems(
  items: ReviewQueueRow[],
  turnsMap: Map<string, TurnRow>,
  now: Date = new Date()
): EnrichedReviewItem[] {
  const nowTime = now.getTime();

  return items.map((item) => {
    const dueTime = new Date(item.dueAt).getTime();
    const isDue = dueTime <= nowTime;
    const diffMs = nowTime - dueTime;
    const daysOverdue = isDue ? Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000))) : 0;
    const turn = turnsMap.get(item.turnId);
    const pastScore = turn?.evaluation ? calculateTurnScore(turn.evaluation) : undefined;

    return {
      ...item,
      isDue,
      daysOverdue,
      turn,
      pastScore,
    };
  });
}

/**
 * Scans a list of turns (e.g. from a completed session) and enqueues any weak turns
 * into the reviewQueue table if they are not already present.
 */
export async function syncSessionWeakTurnsToQueue(
  storage: StorageAdapter,
  turns: TurnRow[],
  options: { now?: Date | undefined; threshold?: number | undefined } = {}
): Promise<number> {
  const threshold = options.threshold ?? 70;
  let addedCount = 0;

  for (const turn of turns) {
    if (isWeakTurn(turn, threshold)) {
      const reviewId = `review-${turn.id}`;
      const existing = await storage.get<ReviewQueueRow>("reviewQueue", reviewId);
      if (!existing) {
        const item = createReviewItem(turn.id, { now: options.now });
        await storage.put("reviewQueue", item);
        addedCount++;
      }
    }
  }

  return addedCount;
}
