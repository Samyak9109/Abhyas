// FR-002, FR-003, FR-004: Zod schemas and inferred types for candidate profiles and documents.
import { z } from "zod";

export const ExperienceLevelSchema = z.enum([
  "intern_fresher",
  "junior", // 1 to 3 years
  "mid", // 3 to 5 years
  "senior", // 5 to 8 years
  "staff_plus", // 8+ years
]);
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;

export const ProfileSchema = z.object({
  id: z.string().min(1),
  level: ExperienceLevelSchema,
  targetRole: z.string().min(1).max(120),
  years: z.number().nonnegative().optional(),
  updatedAt: z.string().datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const IngestedDocumentSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["resume", "jd"]),
  text: z.string().min(1),
  hash: z.string().min(8),
  updatedAt: z.string().datetime(),
});
export type IngestedDocument = z.infer<typeof IngestedDocumentSchema>;

export const StructuredProfileSchema = z.object({
  id: z.string().min(1),
  inputHash: z.string().min(8),
  condensed: z.string().max(4000), // condensed profile under token budget (AI-014)
  skills: z.array(z.string()),
  experiences: z.array(
    z.object({
      role: z.string(),
      company: z.string().optional(),
      highlights: z.array(z.string()),
    })
  ),
  gaps: z.array(z.string()).optional(),
  quantifiedClaims: z.array(z.string()).optional(),
  promptVersion: z.number().int().positive(),
});
export type StructuredProfile = z.infer<typeof StructuredProfileSchema>;
