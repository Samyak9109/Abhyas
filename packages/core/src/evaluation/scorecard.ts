// FR-012, FR-013, FR-014, ADR-006: Session scorecard computation, level fit analysis, and top fix extraction.
import type { DeliveryMetrics } from "../schemas/evaluation.schema.js";
import type { ExperienceLevel } from "../schemas/profile.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";
import { calculateTurnScore } from "./rubric-evaluator.js";

export interface CriterionAverage {
  name: string;
  key: "relevance" | "structure" | "depth" | "clarity" | "levelFit";
  score: number; // 1.0 to 5.0
  percentage: number; // 0 to 100
}

export interface SkillSummary {
  skillId: string;
  score: number; // 0 to 100
  answersCount: number;
}

export interface SessionScorecard {
  sessionId: string;
  overallScore: number; // 0 to 100
  level: ExperienceLevel;
  modality: "voice" | "text";
  isPartial: boolean;
  totalTurns: number;
  scoredTurnsCount: number;
  unscoredTurnsCount: number;
  criterionAverages: CriterionAverage[];
  topThreeFixes: string[];
  skillSummaries: SkillSummary[];
  deliveryAverages?:
    | {
        averageWordsPerMinute: number;
        totalFillerWordCount: number;
        totalPauseSeconds: number;
        averageAnswerWords: number;
      }
    | undefined;
  levelFitNote?: string | undefined;
}

/**
 * Computes the full scorecard for a completed or partial session.
 */
export function computeSessionScorecard(session: SessionRow, turns: TurnRow[]): SessionScorecard {
  const scoredTurns = turns.filter((t) => t.status === "scored" && t.evaluation !== undefined);
  const unscoredTurnsCount = turns.filter((t) => t.status === "unscored").length;
  const scoredTurnsCount = scoredTurns.length;

  // Planned length from session plan if available
  const plannedLength =
    typeof session.plan === "object" && session.plan !== null && "length" in session.plan
      ? (session.plan as { length: number }).length
      : turns.length;

  const isPartial =
    session.status !== "completed" || (plannedLength > 0 && turns.length < plannedLength);

  // 1. Calculate overall score (mean of turn scores)
  let overallScore = 0;
  if (scoredTurnsCount > 0) {
    const totalTurnScore = scoredTurns.reduce((acc, turn) => {
      const c = turn.evaluation!.criteria;
      const mean =
        (c.relevance.score +
          c.structure.score +
          c.depth.score +
          c.clarity.score +
          c.levelFit.score) /
        5;
      const turnScore = ((mean - 1) / 4) * 100;
      return acc + turnScore;
    }, 0);
    overallScore = Math.round(totalTurnScore / scoredTurnsCount);
  }

  // 2. Compute Criterion Averages (1 to 5 scale)
  const criterionTotals = {
    relevance: 0,
    structure: 0,
    depth: 0,
    clarity: 0,
    levelFit: 0,
  };

  for (const turn of scoredTurns) {
    const c = turn.evaluation!.criteria;
    criterionTotals.relevance += c.relevance.score;
    criterionTotals.structure += c.structure.score;
    criterionTotals.depth += c.depth.score;
    criterionTotals.clarity += c.clarity.score;
    criterionTotals.levelFit += c.levelFit.score;
  }

  const criterionNames: Record<keyof typeof criterionTotals, string> = {
    relevance: "Relevance & Directness",
    structure: "Structure & STAR Framing",
    depth: "Technical & Conceptual Depth",
    clarity: "Clarity & Articulation",
    levelFit: "Level Expectations Fit",
  };

  const criterionAverages: CriterionAverage[] = (
    Object.keys(criterionTotals) as Array<keyof typeof criterionTotals>
  ).map((key) => {
    const rawScore = scoredTurnsCount > 0 ? criterionTotals[key] / scoredTurnsCount : 1.0;
    const roundedScore = Math.round(rawScore * 10) / 10;
    const percentage = Math.round(((rawScore - 1) / 4) * 100);
    return {
      key,
      name: criterionNames[key],
      score: roundedScore,
      percentage: Math.max(0, Math.min(100, percentage)),
    };
  });

  // 3. Extract Top Three Actionable Fixes
  // Prioritize fixes from turns with the lowest turn scores
  const sortedByScore = [...scoredTurns].sort((a, b) => {
    const scoreA =
      (a.evaluation!.criteria.relevance.score +
        a.evaluation!.criteria.structure.score +
        a.evaluation!.criteria.depth.score +
        a.evaluation!.criteria.clarity.score +
        a.evaluation!.criteria.levelFit.score) /
      5;
    const scoreB =
      (b.evaluation!.criteria.relevance.score +
        b.evaluation!.criteria.structure.score +
        b.evaluation!.criteria.depth.score +
        b.evaluation!.criteria.clarity.score +
        b.evaluation!.criteria.levelFit.score) /
      5;
    return scoreA - scoreB;
  });

  const uniqueFixes = new Set<string>();
  for (const turn of sortedByScore) {
    if (turn.evaluation?.topFix && turn.evaluation.topFix.trim()) {
      uniqueFixes.add(turn.evaluation.topFix.trim());
      if (uniqueFixes.size >= 3) break;
    }
  }

  // Fallbacks if fewer than 3 fixes were extracted
  const defaultFixes = [
    "Anchor answers with specific metrics and tangible production examples.",
    "Structure thoughts into Context, Actions Taken, and Measured Results.",
    "Discuss technical trade-offs and alternative approaches proactively.",
  ];
  for (const def of defaultFixes) {
    if (uniqueFixes.size < 3) uniqueFixes.add(def);
  }
  const topThreeFixes = Array.from(uniqueFixes).slice(0, 3);

  // 4. Attribute Skill Summaries
  const skillMap: Record<string, { totalScore: number; count: number }> = {};
  for (const turn of scoredTurns) {
    const turnSkillScores = turn.evaluation?.skillScores;
    if (turnSkillScores && Object.keys(turnSkillScores).length > 0) {
      for (const [skillId, score] of Object.entries(turnSkillScores)) {
        if (!skillMap[skillId]) {
          skillMap[skillId] = { totalScore: 0, count: 0 };
        }
        skillMap[skillId].totalScore += score;
        skillMap[skillId].count += 1;
      }
    } else if (turn.skillTags && turn.skillTags.length > 0 && turn.evaluation) {
      const turnScore = calculateTurnScore(turn.evaluation);
      for (const tag of turn.skillTags) {
        if (!skillMap[tag]) {
          skillMap[tag] = { totalScore: 0, count: 0 };
        }
        skillMap[tag].totalScore += turnScore;
        skillMap[tag].count += 1;
      }
    }
  }

  const skillSummaries: SkillSummary[] = Object.entries(skillMap).map(([skillId, data]) => ({
    skillId,
    score: Math.round(data.totalScore / data.count),
    answersCount: data.count,
  }));

  // 5. Compute delivery averages if voice modality was used
  let deliveryAverages: SessionScorecard["deliveryAverages"] = undefined;
  if (session.modality === "voice") {
    const deliveryTurns = turns
      .map((t) => t.delivery)
      .filter((d): d is DeliveryMetrics => d !== undefined);

    if (deliveryTurns.length > 0) {
      const totalWpm = deliveryTurns.reduce((acc, d) => acc + d.wordsPerMinute, 0);
      const totalFillers = deliveryTurns.reduce((acc, d) => acc + d.fillerWordCount, 0);
      const totalPauses = deliveryTurns.reduce((acc, d) => acc + d.pauseSeconds, 0);
      const totalWords = deliveryTurns.reduce((acc, d) => acc + d.answerLengthWords, 0);

      deliveryAverages = {
        averageWordsPerMinute: Math.round((totalWpm / deliveryTurns.length) * 10) / 10,
        totalFillerWordCount: totalFillers,
        totalPauseSeconds: Math.round(totalPauses * 10) / 10,
        averageAnswerWords: Math.round(totalWords / deliveryTurns.length),
      };
    }
  }

  // 6. Level Fit Note (FR-013: A note appears if scores suggest a different level than selected)
  let levelFitNote: string | undefined = undefined;
  if (scoredTurnsCount >= 2) {
    const levelFitAvg = criterionAverages.find((c) => c.key === "levelFit")?.score ?? 3;
    if (session.level === "intern_fresher" && overallScore >= 88 && levelFitAvg >= 4.5) {
      levelFitNote =
        "Your strong depth and trade-off awareness indicate you may be ready to practice at the Junior level.";
    } else if (session.level === "junior" && overallScore >= 90 && levelFitAvg >= 4.5) {
      levelFitNote =
        "Your responses show architecture and autonomous delivery maturity suited for Mid-level practice.";
    } else if (session.level === "senior" && overallScore < 50 && levelFitAvg <= 2.2) {
      levelFitNote =
        "Senior questions probe deep distributed trade-offs and blast-radius control. Practicing at Mid-level may build firmer footing.";
    } else if (session.level === "staff_plus" && overallScore < 50 && levelFitAvg <= 2.2) {
      levelFitNote =
        "Staff+ questions emphasize organizational leverage and multi-year roadmaps. Practicing at Senior level may feel more natural.";
    }
  }

  return {
    sessionId: session.id,
    overallScore,
    level: session.level,
    modality: session.modality,
    isPartial,
    totalTurns: turns.length,
    scoredTurnsCount,
    unscoredTurnsCount,
    criterionAverages,
    topThreeFixes,
    skillSummaries,
    deliveryAverages,
    levelFitNote,
  };
}
