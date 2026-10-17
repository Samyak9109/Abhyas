// FR-012, FR-017, ADR-006: Rubric evaluator with schema validation, level anchors, retry, and unscored handling.
import type { ProviderAdapter } from "../providers/types.js";
import { EvaluationSchema, type Evaluation } from "../schemas/evaluation.schema.js";
import type { ExperienceLevel, StructuredProfile } from "../schemas/profile.schema.js";
import type { RubricLevel } from "../schemas/rubric.schema.js";

export interface EvaluatorQuestionInput {
  text: string;
  skillTags: string[];
  difficulty: number;
  rubricHints?: string[] | undefined;
}

export interface EvaluateAnswerOptions {
  question: EvaluatorQuestionInput;
  answerText: string;
  level: ExperienceLevel;
  targetRole: string;
  rubric: RubricLevel;
  profile?: StructuredProfile | null | undefined;
  provider?: ProviderAdapter | undefined;
  companyValues?: string[] | undefined;
  abortSignal?: AbortSignal | undefined;
  /** Force rule-based basic feedback (e.g. for small local models or offline) */
  forceBasic?: boolean | undefined;
}

export type EvaluationOutcome =
  | {
      status: "scored";
      evaluation: Evaluation;
      turnScore: number; // 0 to 100 scale
      isBasic?: boolean;
    }
  | {
      status: "unscored";
      error: string;
      fallbackEvaluation?: Evaluation | undefined;
    };

/**
 * Calculates turn score on 0 to 100 scale from 1 to 5 criteria:
 * (criterionMean - 1) / 4 * 100 (architecture.md Section 10).
 */
export function calculateTurnScore(evaluation: Evaluation): number {
  const c = evaluation.criteria;
  const mean =
    (c.relevance.score + c.structure.score + c.depth.score + c.clarity.score + c.levelFit.score) /
    5;
  const normalized = ((mean - 1) / 4) * 100;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

/**
 * Evaluates a candidate's answer using fixed rubric level anchors at temperature 0.
 * Automatically retries once on invalid schema; marks turn unscored if retry fails.
 */
export async function evaluateAnswer(options: EvaluateAnswerOptions): Promise<EvaluationOutcome> {
  const {
    question,
    answerText,
    level,
    targetRole,
    rubric,
    profile,
    provider,
    companyValues,
    abortSignal,
    forceBasic,
  } = options;

  const trimmed = answerText.trim();

  // 1. Handle skipped / empty answers immediately without provider calls
  if (!trimmed || trimmed === "[Skipped]" || trimmed === "[Time expired]") {
    const skippedEvaluation: Evaluation = {
      criteria: {
        relevance: {
          score: 1,
          reason: "Answer was skipped or empty.",
          evidence: "No answer provided",
        },
        structure: { score: 1, reason: "No structure provided.", evidence: "No answer provided" },
        depth: {
          score: 1,
          reason: "No technical or experiential depth.",
          evidence: "No answer provided",
        },
        clarity: { score: 1, reason: "No communication provided.", evidence: "No answer provided" },
        levelFit: {
          score: 1,
          reason: "Did not attempt the question.",
          evidence: "No answer provided",
        },
      },
      skillScores: Object.fromEntries(question.skillTags.map((tag) => [tag, 0])),
      topFix: "Attempt to provide at least a high-level summary or outline of your approach.",
      unsupportedClaims: [],
    };
    return {
      status: "scored",
      evaluation: skippedEvaluation,
      turnScore: 0,
      isBasic: true,
    };
  }

  // 2. Rule-based basic path when no provider is supplied or basic is forced
  if (!provider || forceBasic) {
    const basicEval = createRuleBasedEvaluation(question, trimmed, rubric);
    return {
      status: "scored",
      evaluation: basicEval,
      turnScore: calculateTurnScore(basicEval),
      isBasic: true,
    };
  }

  // 3. Build schema-constrained AI evaluation prompt
  const systemPrompt = buildEvaluatorSystemPrompt(rubric, targetRole, level);
  const userPrompt = buildEvaluatorUserPrompt(question, trimmed, profile, companyValues);
  const effectiveSignal = abortSignal ?? new AbortController().signal;

  // Attempt 1
  try {
    const result = await provider.generateObject<Evaluation>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      EvaluationSchema,
      {
        signal: effectiveSignal,
        maxOutputTokens: 1200,
        temperature: 0,
      }
    );

    if (result.ok) {
      const sanitized = sanitizeEvaluation(result.value, question.skillTags);
      return {
        status: "scored",
        evaluation: sanitized,
        turnScore: calculateTurnScore(sanitized),
      };
    } else if (result.error.kind === "invalid_output") {
      // Schema validation failure: retry once per FR-012 below
    } else {
      return {
        status: "unscored",
        error: result.error.message || "Provider call failed during evaluation",
      };
    }
  } catch (err: unknown) {
    return {
      status: "unscored",
      error: err instanceof Error ? err.message : "Provider request failed during evaluation",
    };
  }

  // Attempt 2 (Retry once as per FR-012 / architecture.md Section 10)
  try {
    const retryResult = await provider.generateObject<Evaluation>(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nIMPORTANT: Return valid JSON matching the exact Evaluation schema with criteria scores 1-5.`,
        },
      ],
      EvaluationSchema,
      {
        signal: effectiveSignal,
        maxOutputTokens: 1200,
        temperature: 0,
      }
    );

    if (retryResult.ok) {
      const sanitized = sanitizeEvaluation(retryResult.value, question.skillTags);
      return {
        status: "scored",
        evaluation: sanitized,
        turnScore: calculateTurnScore(sanitized),
      };
    }

    return {
      status: "unscored",
      error: retryResult.error.message || "Failed schema validation after retry",
    };
  } catch (err: unknown) {
    return {
      status: "unscored",
      error: err instanceof Error ? err.message : "Provider request failed during evaluation",
    };
  }
}

/**
 * Builds system prompt with exact level description and 1, 3, 5 rubric anchors.
 */
function buildEvaluatorSystemPrompt(
  rubric: RubricLevel,
  targetRole: string,
  level: ExperienceLevel
): string {
  const c = rubric.criteria;
  return `You are an objective engineering interview evaluator evaluating a candidate for ${targetRole} at ${level} level.
Level Baseline: ${rubric.description}

Calibration Anchors (Scores 1 to 5):
- Relevance:
  1: ${c.relevance.anchors["1"]}
  3: ${c.relevance.anchors["3"]}
  5: ${c.relevance.anchors["5"]}
- Structure:
  1: ${c.structure.anchors["1"]}
  3: ${c.structure.anchors["3"]}
  5: ${c.structure.anchors["5"]}
- Depth:
  1: ${c.depth.anchors["1"]}
  3: ${c.depth.anchors["3"]}
  5: ${c.depth.anchors["5"]}
- Clarity:
  1: ${c.clarity.anchors["1"]}
  3: ${c.clarity.anchors["3"]}
  5: ${c.clarity.anchors["5"]}
- Level Fit:
  1: ${c.levelFit.anchors["1"]}
  3: ${c.levelFit.anchors["3"]}
  5: ${c.levelFit.anchors["5"]}

Rules:
1. Always ground your score in the exact anchors above.
2. For every criterion, provide a concise reason (<= 280 chars) AND a short verbatim excerpt from the candidate's answer as evidence (<= 200 chars).
3. Provide topFix (<= 240 chars) focusing on the single highest-leverage improvement.
4. If the candidate makes claims that contradict or are not found in their verified profile, list them under unsupportedClaims (max 5).
5. Output strict JSON matching the schema.`;
}

function buildEvaluatorUserPrompt(
  question: EvaluatorQuestionInput,
  answerText: string,
  profile?: StructuredProfile | null | undefined,
  companyValues?: string[] | undefined
): string {
  let prompt = `Question Asked: "${question.text}"\n`;
  if (question.rubricHints && question.rubricHints.length > 0) {
    prompt += `Key Technical Concepts Expected: ${question.rubricHints.join(", ")}\n`;
  }
  if (companyValues && companyValues.length > 0) {
    prompt += `Company Values Considered: ${companyValues.join(", ")}\n`;
  }
  if (profile) {
    prompt += `Candidate Verified Profile Summary:\n${profile.condensed || profile.skills.join(", ")}\n`;
  }

  prompt += `\nCandidate's Verbatim Answer:\n"""\n${answerText}\n"""\n`;
  prompt += `\nEvaluate the answer against the rubric criteria (scores 1-5).`;
  return prompt;
}

/**
 * Guarantees that evaluation strings adhere to length caps and skill scores are mapped.
 */
function sanitizeEvaluation(raw: Evaluation, skillTags: string[]): Evaluation {
  const sanitizeCrit = (c: { score: number; reason: string; evidence: string }) => ({
    score: Math.max(1, Math.min(5, Math.round(c.score))),
    reason: (c.reason || "").slice(0, 280),
    evidence: (c.evidence || "").slice(0, 200),
  });

  const criteria = {
    relevance: sanitizeCrit(raw.criteria.relevance),
    structure: sanitizeCrit(raw.criteria.structure),
    depth: sanitizeCrit(raw.criteria.depth),
    clarity: sanitizeCrit(raw.criteria.clarity),
    levelFit: sanitizeCrit(raw.criteria.levelFit),
  };

  const mean =
    (criteria.relevance.score +
      criteria.structure.score +
      criteria.depth.score +
      criteria.clarity.score +
      criteria.levelFit.score) /
    5;
  const turnScore = Math.max(0, Math.min(100, Math.round(((mean - 1) / 4) * 100)));

  const skillScores: Record<string, number> = { ...(raw.skillScores || {}) };
  for (const tag of skillTags) {
    if (typeof skillScores[tag] !== "number") {
      skillScores[tag] = turnScore;
    } else {
      skillScores[tag] = Math.max(0, Math.min(100, Math.round(skillScores[tag])));
    }
  }

  return {
    criteria,
    skillScores,
    topFix: (raw.topFix || "Strengthen your technical depth and provide concrete evidence.").slice(
      0,
      240
    ),
    unsupportedClaims: (raw.unsupportedClaims || []).slice(0, 5).map((s) => s.slice(0, 200)),
  };
}

/**
 * Deterministic rule-based evaluation for small local models, offline practice, or provider fallbacks.
 */
export function createRuleBasedEvaluation(
  question: EvaluatorQuestionInput,
  answerText: string,
  rubric: RubricLevel
): Evaluation {
  const words = answerText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = answerText.toLowerCase();

  // 1. Structure score
  const structureMarkers = [
    "situation",
    "task",
    "action",
    "result",
    "first",
    "second",
    "then",
    "finally",
    "because",
    "since",
    "trade-off",
    "however",
    "therefore",
    "for example",
    "approach",
    "algorithm",
    "step",
    "initialize",
  ];
  const matchedMarkers = structureMarkers.filter((m) => lower.includes(m)).length;
  let structureScore = 2;
  if (matchedMarkers >= 3 && wordCount >= 40) structureScore = 4;
  else if (matchedMarkers >= 1 && wordCount >= 20) structureScore = 3;
  else if (wordCount >= 80) structureScore = 3;

  // 2. Depth score
  const hasNumbers = /\b\d+(\.\d+)?(%|ms|s|gb|mb|tb|k|m)?\b/i.test(answerText);
  let depthScore = 2;
  if (wordCount >= 70 && hasNumbers) depthScore = 4;
  else if (wordCount >= 40) depthScore = 3;
  else if (wordCount < 15) depthScore = 1;

  // 3. Relevance score
  const qWords = question.text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const matchedQWords = qWords.filter((qw) => lower.includes(qw)).length;
  let relevanceScore = 3;
  if (matchedQWords >= 3) relevanceScore = 4;
  else if (matchedQWords === 0 && wordCount < 25) relevanceScore = 2;

  // 4. Clarity score
  let clarityScore = 3;
  if (wordCount >= 25 && wordCount <= 250) clarityScore = 4;
  else if (wordCount > 350) clarityScore = 3;
  else if (wordCount < 15) clarityScore = 2;

  // 5. Level fit score and level calibration (FR-017)
  let levelFitScore = Math.round((structureScore + depthScore + relevanceScore) / 3);

  // Calibrate depth and levelFit against experience level expectations (FR-017)
  if (rubric.level === "intern_fresher") {
    // Foundational expectations: core fundamentals, learning attitude
    if (relevanceScore >= 3 && structureScore >= 3) {
      levelFitScore = Math.max(levelFitScore, 4);
    }
  } else if (rubric.level === "junior") {
    // Junior expectations: working code, basic implementation
    if (depthScore >= 3 && structureScore >= 3) {
      levelFitScore = Math.max(levelFitScore, 3);
    }
  } else if (rubric.level === "mid") {
    // Mid expectations: trade-offs, edge cases, schema/API durability
    const hasTradeoffs = /\b(trade-off|alternative|edge case|index|retry|idempotent|cache)\b/i.test(
      answerText
    );
    if (!hasTradeoffs && depthScore < 4) {
      levelFitScore = Math.min(levelFitScore, 3);
    }
  } else if (rubric.level === "senior") {
    // Senior expectations: distributed trade-offs, blast radius, failure modes, concurrency, scale
    const hasSeniorDepth =
      /\b(trade-off|architecture|scale|concurrency|distributed|failure|blast radius|resilien|monitoring|latency|bottleneck|partition)\b/i.test(
        answerText
      );
    if (!hasSeniorDepth) {
      depthScore = Math.min(depthScore, 2);
      levelFitScore = Math.min(levelFitScore, 2);
    }
  } else if (rubric.level === "staff_plus") {
    // Staff+ expectations: organizational leverage, multi-year strategy, platform durability, Conway's Law
    const hasStaffDepth =
      /\b(strategy|organizational|culture|conway|governance|multi-year|platform|leverage|cross-team|portfolio|roi)\b/i.test(
        answerText
      );
    if (!hasStaffDepth) {
      depthScore = Math.min(depthScore, 2);
      levelFitScore = 1;
    }
  }

  const excerpt = answerText.slice(0, 160).trim();

  const evaluation: Evaluation = {
    criteria: {
      relevance: {
        score: relevanceScore,
        reason:
          relevanceScore >= 3
            ? "Addresses core question concepts directly."
            : "Could link more closely to the prompt.",
        evidence: excerpt,
      },
      structure: {
        score: structureScore,
        reason:
          structureScore >= 3
            ? "Follows an organized narrative sequence."
            : "Structure would benefit from clear step-by-step progression.",
        evidence: excerpt,
      },
      depth: {
        score: depthScore,
        reason:
          depthScore >= 3
            ? "Provides concrete technical details and context."
            : "Add specific trade-offs or technical metrics to deepen the answer.",
        evidence: excerpt,
      },
      clarity: {
        score: clarityScore,
        reason:
          clarityScore >= 3 ? "Clear and succinct communication." : "Clarify the main takeaway.",
        evidence: excerpt,
      },
      levelFit: {
        score: levelFitScore,
        reason: `Performance calibrated against ${rubric.level} baseline expectations.`,
        evidence: excerpt,
      },
    },
    skillScores: {},
    topFix:
      depthScore <= 2
        ? "Include concrete metrics, trade-offs, and technical mechanisms from your experience."
        : structureScore <= 2
          ? "Structure your response into Context, Action taken, and Business/Technical outcome."
          : "Directly highlight architectural alternatives and operational lessons learned.",
    unsupportedClaims: [],
  };

  const turnScore = calculateTurnScore(evaluation);
  for (const tag of question.skillTags) {
    evaluation.skillScores[tag] = turnScore;
  }

  return evaluation;
}
