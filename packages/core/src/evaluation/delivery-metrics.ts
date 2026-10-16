// FR-012, FR-013, ADR-006: Local delivery metrics calculator for voice interview turns.
import { DeliveryMetricsSchema, type DeliveryMetrics } from "../schemas/evaluation.schema.js";

/**
 * Common verbal filler words and filler phrases in spoken English.
 * Measured locally with zero third-party or server requests.
 */
export const FILLER_WORDS = [
  "um",
  "uh",
  "er",
  "ah",
  "like",
  "you know",
  "actually",
  "basically",
  "so",
  "sort of",
  "kind of",
  "i mean",
  "right",
] as const;

export interface CalculateDeliveryMetricsOptions {
  /** Candidate spoken transcript */
  answerText: string;
  /** Speaking duration in seconds (must be >= 0) */
  durationSeconds: number;
  /** Estimated pause or silence time in seconds */
  pauseSeconds?: number;
}

/**
 * Computes speech delivery metrics (WPM, filler word count, pause duration, word count)
 * from a spoken answer and audio elapsed timing.
 */
export function calculateDeliveryMetrics(
  options: CalculateDeliveryMetricsOptions
): DeliveryMetrics {
  const { answerText, durationSeconds, pauseSeconds = 0 } = options;

  // 1. Calculate word count (splitting by whitespace, excluding empty tokens)
  const trimmed = answerText.trim();
  const words = trimmed.length > 0 ? trimmed.split(/\s+/).filter(Boolean) : [];
  const answerLengthWords = words.length;

  // 2. Compute Words Per Minute (WPM)
  // Clamp duration to at least 1 second to avoid division by zero
  const effectiveDurationSeconds = Math.max(durationSeconds, 1);
  const wordsPerMinute =
    answerLengthWords > 0
      ? Math.round((answerLengthWords / (effectiveDurationSeconds / 60)) * 10) / 10
      : 0;

  // 3. Count filler words and phrases
  let fillerWordCount = 0;
  const lowerText = ` ${trimmed.toLowerCase()} `;

  for (const filler of FILLER_WORDS) {
    // Regex matching word boundaries around the filler phrase
    const regex = new RegExp(`\\b${escapeRegExp(filler)}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches) {
      fillerWordCount += matches.length;
    }
  }

  const rawMetrics: DeliveryMetrics = {
    wordsPerMinute,
    fillerWordCount,
    pauseSeconds: Math.round(pauseSeconds * 10) / 10,
    answerLengthWords,
  };

  return DeliveryMetricsSchema.parse(rawMetrics);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
