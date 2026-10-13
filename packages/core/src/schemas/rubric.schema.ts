// FR-012, FR-017, ADR-006: Rubric schema with level anchors across experience levels.
import { z } from "zod";
import { ExperienceLevelSchema } from "./profile.schema.js";

export const RubricCriterionKeySchema = z.enum([
  "relevance",
  "structure",
  "depth",
  "clarity",
  "levelFit",
]);
export type RubricCriterionKey = z.infer<typeof RubricCriterionKeySchema>;

export const RubricAnchorsSchema = z.object({
  "1": z.string().min(10, "Anchor 1 description must be at least 10 characters"),
  "3": z.string().min(10, "Anchor 3 description must be at least 10 characters"),
  "5": z.string().min(10, "Anchor 5 description must be at least 10 characters"),
});
export type RubricAnchors = z.infer<typeof RubricAnchorsSchema>;

export const RubricCriterionDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  anchors: RubricAnchorsSchema,
});
export type RubricCriterionDefinition = z.infer<typeof RubricCriterionDefinitionSchema>;

export const CalibrationAxesSchema = z.object({
  depth: z.string().min(10),
  ambiguity: z.string().min(10),
  expectedScope: z.string().min(10),
  followUpPressure: z.string().min(10),
  behavioralExpectations: z.string().min(10),
});
export type CalibrationAxes = z.infer<typeof CalibrationAxesSchema>;

export const RubricLevelSchema = z.object({
  level: ExperienceLevelSchema,
  description: z.string().min(10),
  axes: CalibrationAxesSchema,
  criteria: z.object({
    relevance: RubricCriterionDefinitionSchema,
    structure: RubricCriterionDefinitionSchema,
    depth: RubricCriterionDefinitionSchema,
    clarity: RubricCriterionDefinitionSchema,
    levelFit: RubricCriterionDefinitionSchema,
  }),
});
export type RubricLevel = z.infer<typeof RubricLevelSchema>;
