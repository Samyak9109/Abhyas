// FR-018, FR-016: Daily drill recommendation targeting weakest calibrated skill.
import type { SessionRow, SkillStatRow } from "../schemas/storage-rows.schema.js";
import { formatLocalDate } from "./streak.js";
import type { DailyDrillRecommendation } from "./types.js";

export interface DailyDrillOptions {
  referenceDate?: Date | undefined;
  timeZone?: string | undefined;
  defaultSkillId?: string | undefined; // default: "system_design"
}

/**
 * Recommends today's daily practice drill.
 * Deterministically targets the user's weakest calibrated skill to drive deliberate practice,
 * and detects whether today's drill has already been completed.
 */
export function getDailyDrillRecommendation(
  sessions: SessionRow[],
  skillStats: SkillStatRow[],
  options: DailyDrillOptions = {}
): DailyDrillRecommendation {
  const referenceDate = options.referenceDate ?? new Date();
  const timeZone = options.timeZone;
  const defaultSkillId = options.defaultSkillId ?? "system_design";

  const todayStr = formatLocalDate(referenceDate, timeZone);

  // 1. Check if a drill was already completed today
  const isCompletedToday = sessions.some((s) => {
    if (s.status !== "completed") return false;
    const isDrill = Boolean(
      typeof s.plan === "object" && s.plan !== null && "isDrill" in s.plan && s.plan.isDrill
    );
    if (!isDrill) return false;
    const sessionDate = formatLocalDate(s.startedAt, timeZone);
    return sessionDate === todayStr;
  });

  // 2. Determine target skill
  if (!skillStats || skillStats.length === 0) {
    return {
      skillId: defaultSkillId,
      isCompletedToday,
      reason: "foundational_default",
      score: null,
    };
  }

  // Look for calibrated skills with medium or high confidence
  const calibrated = skillStats.filter((s) => s.confidence === "medium" || s.confidence === "high");

  if (calibrated.length > 0) {
    // Sort ascending by score (lowest score first)
    const sorted = [...calibrated].sort((a, b) => a.score - b.score);
    const weakest = sorted[0]!;
    return {
      skillId: weakest.skillId,
      isCompletedToday,
      reason: "weakest_calibrated",
      score: weakest.score,
    };
  }

  // If none are calibrated yet, pick lowest score among low confidence
  const sortedAll = [...skillStats].sort((a, b) => a.score - b.score);
  const lowest = sortedAll[0]!;
  return {
    skillId: lowest.skillId,
    isCompletedToday,
    reason: "uncalibrated_focus",
    score: lowest.score,
  };
}
