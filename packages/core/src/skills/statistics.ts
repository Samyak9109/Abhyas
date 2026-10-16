// FR-014, architecture.md 14: Pure deterministic skill statistics engine.
import type { SkillStatRow } from "../schemas/storage-rows.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";
import { calculateTurnScore } from "../evaluation/rubric-evaluator.js";

/** Default half-life in turns for recency weighting (architecture.md 14) */
export const DEFAULT_RECENCY_HALF_LIFE = 8;

/** Default taxonomy version */
export const DEFAULT_TAXONOMY_VERSION = 1;

/** Canonical delivery skill IDs (evaluated only during voice sessions) */
export const DEFAULT_DELIVERY_SKILL_IDS: readonly string[] = ["clarity", "pacing", "filler_words"];

export interface ScoredSkillTurn {
  score: number;
  timestamp: string;
  turnId: string;
}

export interface RecomputeOptions {
  taxonomyVersion?: number | undefined;
  recencyHalfLife?: number | undefined;
  knownSkillIds?: readonly string[] | ReadonlySet<string> | Set<string> | undefined;
  deliverySkillIds?: readonly string[] | ReadonlySet<string> | Set<string> | undefined;
}

/**
 * Calculates confidence based on sample size n (architecture.md 14):
 * - low if n < 3
 * - medium if 3 <= n < 8
 * - high if n >= 8
 */
export function calculateConfidence(n: number): "low" | "medium" | "high" {
  if (n < 3) return "low";
  if (n < 8) return "medium";
  return "high";
}

/**
 * Calculates the recency-weighted mean score for a chronological series of answers.
 * Weight for answer at index i (0 = oldest, n - 1 = latest):
 * w = 0.5 ^ (age / H), where age = (n - 1 - i), H = half-life (default 8).
 */
export function calculateRecencyWeightedScore(
  scores: number[],
  halfLife = DEFAULT_RECENCY_HALF_LIFE
): number {
  if (scores.length === 0) return 0;
  if (scores.length === 1) return Math.round(scores[0]! * 10) / 10;

  const n = scores.length;
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < n; i++) {
    const age = n - 1 - i; // 0 for latest answer
    const weight = Math.pow(0.5, age / halfLife);
    weightedSum += scores[i]! * weight;
    totalWeight += weight;
  }

  const result = weightedSum / totalWeight;
  const clamped = Math.max(0, Math.min(100, result));
  return Math.round(clamped * 10) / 10;
}

/**
 * Calculates trend: mean of the last 5 answers minus the mean of the 5 before (architecture.md 14).
 * Only shown when n >= 10. Returns undefined when n < 10.
 *
 * Array input is chronological (oldest to newest):
 * Last 5 answers: scores[n-5 .. n-1]
 * The 5 before: scores[n-10 .. n-6]
 */
export function calculateTrend(scores: number[]): number | undefined {
  const n = scores.length;
  if (n < 10) return undefined;

  const lastFive = scores.slice(n - 5, n);
  const fiveBefore = scores.slice(n - 10, n - 5);

  const meanLastFive = lastFive.reduce((sum, v) => sum + v, 0) / 5;
  const meanFiveBefore = fiveBefore.reduce((sum, v) => sum + v, 0) / 5;

  const delta = meanLastFive - meanFiveBefore;
  return Math.round(delta * 10) / 10;
}

/**
 * Selects the weakest skill according to FR-014 / architecture.md 14:
 * - Lowest score among skills with at least medium confidence (n >= 3).
 * - If none have at least medium confidence, the least-practiced skill (lowest n, including 0).
 */
export function selectWeakestSkill(
  stats: SkillStatRow[],
  allKnownSkillIds?: readonly string[]
): string | undefined {
  if (stats.length === 0 && (!allKnownSkillIds || allKnownSkillIds.length === 0)) {
    return undefined;
  }

  const statMap = new Map<string, SkillStatRow>(stats.map((s) => [s.skillId, s]));

  // 1. Look for skills with at least medium confidence (n >= 3)
  const eligibleStats = stats.filter((s) => s.confidence === "medium" || s.confidence === "high");
  if (eligibleStats.length > 0) {
    // Sort by lowest score; tie-break by lowest n, then alphabetical skillId
    eligibleStats.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.n !== b.n) return a.n - b.n;
      return a.skillId.localeCompare(b.skillId);
    });
    return eligibleStats[0]?.skillId;
  }

  // 2. Fallback: least-practiced skill
  if (allKnownSkillIds && allKnownSkillIds.length > 0) {
    // Check if any known skill has n = 0 (never practiced)
    const unpracticed = allKnownSkillIds
      .filter((id) => !statMap.has(id) || statMap.get(id)!.n === 0)
      .sort((a, b) => a.localeCompare(b));

    if (unpracticed.length > 0) {
      return unpracticed[0];
    }
  }

  if (stats.length === 0) return undefined;

  // Pick lowest n among low-confidence skills
  const sorted = [...stats].sort((a, b) => {
    if (a.n !== b.n) return a.n - b.n;
    if (a.score !== b.score) return a.score - b.score;
    return a.skillId.localeCompare(b.skillId);
  });
  return sorted[0]?.skillId;
}

/**
 * Selects the strongest skill according to FR-014:
 * - Highest score among skills with at least medium confidence (n >= 3).
 * - Returns undefined if no skill has at least medium confidence.
 */
export function selectStrongestSkill(stats: SkillStatRow[]): string | undefined {
  const eligibleStats = stats.filter((s) => s.confidence === "medium" || s.confidence === "high");
  if (eligibleStats.length === 0) return undefined;

  eligibleStats.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.n !== b.n) return b.n - a.n;
    return a.skillId.localeCompare(b.skillId);
  });
  return eligibleStats[0]?.skillId;
}

/**
 * Deterministically recomputes skill statistics from stored turns and sessions.
 * Follows FR-014 and architecture.md 14:
 * - Turn score on 0 to 100 scale: (criterionMean - 1) / 4 * 100.
 * - Recency-weighted mean over scored turns with weight 0.5 ^ (age / 8).
 * - Text sessions do not contribute to delivery skills.
 * - Unknown tags are safely excluded.
 */
export function recomputeSkillStats(
  turns: TurnRow[],
  sessions: SessionRow[] = [],
  options: RecomputeOptions = {}
): SkillStatRow[] {
  const taxonomyVersion = options.taxonomyVersion ?? DEFAULT_TAXONOMY_VERSION;
  const halfLife = options.recencyHalfLife ?? DEFAULT_RECENCY_HALF_LIFE;
  const knownSkillIds = options.knownSkillIds
    ? options.knownSkillIds instanceof Set
      ? options.knownSkillIds
      : new Set(options.knownSkillIds)
    : undefined;
  const deliverySkillIds = options.deliverySkillIds
    ? options.deliverySkillIds instanceof Set
      ? options.deliverySkillIds
      : new Set(options.deliverySkillIds)
    : new Set(DEFAULT_DELIVERY_SKILL_IDS);

  // Map session ID to metadata (startedAt, modality)
  const sessionMap = new Map<string, SessionRow>(sessions.map((s) => [s.id, s]));

  // Filter only scored turns with an evaluation
  const scoredTurns = turns.filter(
    (t) => t.status === "scored" && t.evaluation !== undefined && t.skillTags.length > 0
  );

  // Sort turns deterministically into chronological order
  const sortedTurns = [...scoredTurns].sort((a, b) => {
    const sessionA = sessionMap.get(a.sessionId);
    const sessionB = sessionMap.get(b.sessionId);

    const timeA = sessionA?.startedAt ?? a.id;
    const timeB = sessionB?.startedAt ?? b.id;

    if (timeA !== timeB) return timeA.localeCompare(timeB);
    if (a.sessionId !== b.sessionId) return a.sessionId.localeCompare(b.sessionId);
    if (a.index !== b.index) return a.index - b.index;
    return a.id.localeCompare(b.id);
  });

  // Group turn scores and timestamps by skillId
  const skillTurns = new Map<string, ScoredSkillTurn[]>();

  for (const turn of sortedTurns) {
    const session = sessionMap.get(turn.sessionId);
    const isTextModality = session?.modality === "text";

    // Fallback ISO timestamp
    const timestamp =
      session?.endedAt ??
      session?.startedAt ??
      new Date(1700000000000 + turn.index * 60000).toISOString();

    for (const tag of turn.skillTags) {
      // Unknown tag handling: turn kept, excluded from stats (FR-014)
      if (knownSkillIds && !knownSkillIds.has(tag)) {
        continue;
      }

      // Delivery skills check: text sessions do not contribute to delivery skills (architecture.md 14)
      if (isTextModality && deliverySkillIds.has(tag)) {
        continue;
      }

      // Score resolution: check skillScores record first, fallback to turn score
      let score: number;
      if (
        turn.evaluation?.skillScores &&
        typeof turn.evaluation.skillScores[tag] === "number" &&
        Number.isFinite(turn.evaluation.skillScores[tag])
      ) {
        score = turn.evaluation.skillScores[tag]!;
      } else {
        score = calculateTurnScore(turn.evaluation!);
      }

      const list = skillTurns.get(tag) ?? [];
      list.push({ score, timestamp, turnId: turn.id });
      skillTurns.set(tag, list);
    }
  }

  // Build SkillStatRow for each practiced skill
  const stats: SkillStatRow[] = [];

  for (const [skillId, entries] of skillTurns.entries()) {
    const n = entries.length;
    if (n === 0) continue;

    const scores = entries.map((e) => e.score);
    const score = calculateRecencyWeightedScore(scores, halfLife);
    const confidence = calculateConfidence(n);
    const trend = calculateTrend(scores);
    const lastPracticedAt = entries[n - 1]!.timestamp;

    stats.push({
      skillId,
      score,
      n,
      confidence,
      lastPracticedAt,
      trend,
      taxonomyVersion,
    });
  }

  // Sort deterministically by skillId
  stats.sort((a, b) => a.skillId.localeCompare(b.skillId));

  return stats;
}
