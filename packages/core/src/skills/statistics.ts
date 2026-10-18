// FR-014, architecture.md 14: Pure deterministic skill statistics engine.
import type { SkillStatRow } from "../schemas/storage-rows.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";
import type { ExperienceLevel } from "../schemas/profile.schema.js";
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
  const hasConfident = stats.some((s) => s.confidence === "medium" || s.confidence === "high");
  if (!hasConfident && allKnownSkillIds && allKnownSkillIds.length > 0) {
    const statMap = new Map<string, SkillStatRow>(stats.map((s) => [s.skillId, s]));
    const unpracticed = allKnownSkillIds
      .filter((id) => !statMap.has(id) || statMap.get(id)!.n === 0)
      .sort((a, b) => a.localeCompare(b));

    if (unpracticed.length > 0) {
      return unpracticed[0];
    }
  }

  return selectWeakestSkills(stats, 1)[0]?.skillId;
}

/**
 * Selects the strongest skill according to FR-014:
 * - Highest score among skills with at least medium confidence (n >= 3).
 * - Returns undefined if no skill has at least medium confidence.
 */
export function selectStrongestSkill(stats: SkillStatRow[]): string | undefined {
  return selectStrongestSkills(stats, 1)[0]?.skillId;
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
    const sessionPlan = session?.plan as { isDrill?: boolean; targetSkillId?: string } | undefined;
    const isDrill = sessionPlan?.isDrill === true;
    const targetSkillId = sessionPlan?.targetSkillId;

    // Fallback ISO timestamp
    const timestamp =
      session?.endedAt ??
      session?.startedAt ??
      new Date(1700000000000 + turn.index * 60000).toISOString();

    for (const tag of turn.skillTags) {
      // Drill isolation: drills only update the targeted skill's statistics (FR-016)
      if (isDrill && targetSkillId && tag !== targetSkillId) {
        continue;
      }

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

// ---------------------------------------------------------------------------
// FR-015: Dashboard Visualization & Calibration Helpers
// ---------------------------------------------------------------------------

export type ScoreBand = "strong" | "developing" | "needs_work";

/**
 * Returns score band according to design.md section 9:
 * - 75 to 100: "Strong"
 * - 50 to 74: "Developing"
 * - below 50: "Needs work" (uses --warning, not --danger)
 */
export function getScoreBand(score: number): ScoreBand {
  if (score >= 75) return "strong";
  if (score >= 50) return "developing";
  return "needs_work";
}

export function getScoreBandLabel(band: ScoreBand): string {
  switch (band) {
    case "strong":
      return "Strong";
    case "developing":
      return "Developing";
    case "needs_work":
      return "Needs work";
  }
}

/** Default threshold in days after which a skill is marked stale (needs refresh) */
export const STALE_SKILL_THRESHOLD_DAYS = 14;

/**
 * Checks whether a skill has not been practiced within thresholdDays (FR-015 / design.md 8).
 */
export function isSkillStale(
  lastPracticedAt: string,
  now: Date | string = new Date(),
  thresholdDays = STALE_SKILL_THRESHOLD_DAYS
): boolean {
  const lastTime = new Date(lastPracticedAt).getTime();
  const currentTime = typeof now === "string" ? new Date(now).getTime() : now.getTime();
  if (Number.isNaN(lastTime) || Number.isNaN(currentTime)) return false;
  const elapsedDays = (currentTime - lastTime) / (1000 * 60 * 60 * 24);
  return elapsedDays >= thresholdDays;
}

/**
 * Level benchmark score targets (FR-015: "benchmark against level").
 */
export const LEVEL_BENCHMARKS: Record<ExperienceLevel, number> = {
  intern_fresher: 60,
  junior: 65,
  mid: 70,
  senior: 75,
  staff_plus: 80,
};

/**
 * Returns the target benchmark score for a given level (defaults to mid: 70).
 */
export function getBenchmarkForLevel(level?: ExperienceLevel | null): number {
  if (!level || !(level in LEVEL_BENCHMARKS)) {
    return LEVEL_BENCHMARKS.mid;
  }
  return LEVEL_BENCHMARKS[level];
}

/**
 * Selects the top N weakest skills (FR-015):
 * - Prioritizes skills with at least medium confidence (n >= 3) sorted by lowest score.
 * - Followed by low-confidence skills sorted by lowest sample count then score.
 */
export function selectWeakestSkills(
  stats: SkillStatRow[],
  limit = 3,
  allKnownSkillIds?: readonly string[]
): SkillStatRow[] {
  if (stats.length === 0 && (!allKnownSkillIds || allKnownSkillIds.length === 0)) {
    return [];
  }

  // 1. Medium and high confidence
  const mediumOrHigh = stats.filter((s) => s.confidence === "medium" || s.confidence === "high");
  mediumOrHigh.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.n !== b.n) return a.n - b.n;
    return a.skillId.localeCompare(b.skillId);
  });

  // 2. Low confidence
  const lowConfidence = stats.filter((s) => s.confidence === "low");
  lowConfidence.sort((a, b) => {
    if (a.n !== b.n) return a.n - b.n;
    if (a.score !== b.score) return a.score - b.score;
    return a.skillId.localeCompare(b.skillId);
  });

  // Combine
  const combined = [...mediumOrHigh, ...lowConfidence];
  return combined.slice(0, limit);
}

/**
 * Selects the top N strongest skills (FR-015):
 * - Only skills with at least medium confidence (n >= 3) qualify as true strengths.
 * - Sorted by highest score descending.
 */
export function selectStrongestSkills(stats: SkillStatRow[], limit = 3): SkillStatRow[] {
  const eligible = stats.filter((s) => s.confidence === "medium" || s.confidence === "high");
  eligible.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.n !== b.n) return b.n - a.n;
    return a.skillId.localeCompare(b.skillId);
  });
  return eligible.slice(0, limit);
}

export interface SkillHistoryPoint {
  turnId: string;
  score: number;
  timestamp: string;
}

/**
 * Extracts chronological score history points for a specific skill (for trend lines / sparklines).
 */
export function computeSkillHistory(
  turns: TurnRow[],
  sessions: SessionRow[] = [],
  skillId: string
): SkillHistoryPoint[] {
  const sessionMap = new Map<string, SessionRow>(sessions.map((s) => [s.id, s]));
  const scoredTurns = turns.filter(
    (t) => t.status === "scored" && t.evaluation !== undefined && t.skillTags.includes(skillId)
  );

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

  const isDelivery = DEFAULT_DELIVERY_SKILL_IDS.includes(skillId);
  const history: SkillHistoryPoint[] = [];

  for (const turn of sortedTurns) {
    const session = sessionMap.get(turn.sessionId);
    const sessionPlan = session?.plan as { isDrill?: boolean; targetSkillId?: string } | undefined;
    if (
      sessionPlan?.isDrill &&
      sessionPlan?.targetSkillId &&
      sessionPlan.targetSkillId !== skillId
    ) {
      continue;
    }
    if (session?.modality === "text" && isDelivery) {
      continue;
    }
    const timestamp =
      session?.endedAt ??
      session?.startedAt ??
      new Date(1700000000000 + turn.index * 60000).toISOString();

    let score: number;
    if (
      turn.evaluation?.skillScores &&
      typeof turn.evaluation.skillScores[skillId] === "number" &&
      Number.isFinite(turn.evaluation.skillScores[skillId])
    ) {
      score = turn.evaluation.skillScores[skillId]!;
    } else {
      score = calculateTurnScore(turn.evaluation!);
    }

    history.push({ turnId: turn.id, score, timestamp });
  }

  return history;
}
