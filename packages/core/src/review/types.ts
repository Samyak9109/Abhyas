// FR-028: Spaced repetition and review queue types.
import type { ReviewQueueRow, TurnRow } from "../schemas/storage-rows.schema.js";

export type { ReviewQueueRow } from "../schemas/storage-rows.schema.js";

export interface ReviewOptions {
  /** Maximum number of review questions presented in a single day (default: 10). */
  maxDailyCap?: number | undefined;
  /** Score threshold (0-100) below which turns are classified as weak (default: 70). */
  weakTurnThreshold?: number | undefined;
  /** Current date/time reference (default: Date.now()). */
  referenceDate?: Date | string | undefined;
}

export interface EnrichedReviewItem extends ReviewQueueRow {
  isDue: boolean;
  daysOverdue: number;
  turn?: TurnRow | undefined;
  pastScore?: number | undefined;
}
