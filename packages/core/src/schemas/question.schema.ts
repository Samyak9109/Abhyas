// FR-006, FR-007, FR-017, ADR-006: Question schema and question bank types.
import { z } from "zod";
import { ExperienceLevelSchema } from "./profile.schema.js";

export const QuestionTypeSchema = z.enum([
  "behavioral",
  "technical",
  "system_design",
  "dsa_verbal",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "Question ID must be lowercase alphanumeric with underscores/dashes"),
  text: z.string().min(10).max(1000),
  type: QuestionTypeSchema,
  skillTags: z.array(z.string().min(1)).min(1, "Question must have at least one skill tag"),
  level: ExperienceLevelSchema,
  difficulty: z.number().int().min(1).max(5),
  followUps: z.array(z.string().min(5)).default([]),
  rubricHints: z.array(z.string().min(5)).default([]),
  source: z.string().min(1),
  license: z.string().min(1),
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuestionBankSchema = z
  .array(QuestionSchema)
  .min(1, "Question bank must contain at least one question")
  .refine(
    (questions) => {
      const ids = new Set<string>();
      for (const q of questions) {
        if (ids.has(q.id)) {
          return false;
        }
        ids.add(q.id);
      }
      return true;
    },
    {
      message: "Question bank records must have unique IDs",
    }
  );
export type QuestionBank = z.infer<typeof QuestionBankSchema>;
