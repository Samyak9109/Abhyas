// FR-012, FR-013, ADR-006: Zod schemas for answer evaluation, rubric criteria, and delivery metrics.
import { z } from "zod";

export const CriterionSchema = z.object({
  score: z.number().int().min(1).max(5),
  reason: z.string().max(280),
  // Evidence must come from the candidate's own answer so feedback is verifiable.
  evidence: z.string().max(200),
});
export type Criterion = z.infer<typeof CriterionSchema>;

export const EvaluationSchema = z.object({
  criteria: z.object({
    relevance: CriterionSchema,
    structure: CriterionSchema, // STAR framing
    depth: CriterionSchema,
    clarity: CriterionSchema,
    levelFit: CriterionSchema,
  }),
  skillScores: z.record(z.string(), z.number().min(0).max(100)),
  topFix: z.string().max(240),
  unsupportedClaims: z.array(z.string()).max(5),
  isBasic: z.boolean().optional(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const DeliveryMetricsSchema = z.object({
  wordsPerMinute: z.number().nonnegative(),
  fillerWordCount: z.number().int().nonnegative(),
  pauseSeconds: z.number().nonnegative(),
  answerLengthWords: z.number().int().nonnegative(),
});
export type DeliveryMetrics = z.infer<typeof DeliveryMetricsSchema>;
