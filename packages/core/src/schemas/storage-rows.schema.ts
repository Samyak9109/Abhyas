// FR-001: Zod schemas for every persisted row. Reads validate against these;
// invalid rows are quarantined instead of silently dropped (ADR-004).
import { z } from "zod";
import { DeliveryMetricsSchema, EvaluationSchema } from "./evaluation.schema";
import { ExperienceLevelSchema, IngestedDocumentSchema, ProfileSchema } from "./profile.schema";
import { ModelSanityResultSchema } from "../local/sanity";

export const ProfileRowSchema = ProfileSchema;
export type ProfileRow = z.infer<typeof ProfileRowSchema>;

export const DocumentRowSchema = IngestedDocumentSchema;
export type DocumentRow = z.infer<typeof DocumentRowSchema>;

// `json` keeps the full structured profile document; the typed fields are what
// the app reads, the rest stays for forensics and future fields.
export const StructuredProfileRowSchema = z.object({
  id: z.string().min(1),
  inputHash: z.string().min(8),
  json: z.unknown(),
  condensed: z.string().max(4000),
  promptVersion: z.number().int().positive(),
});
export type StructuredProfileRow = z.infer<typeof StructuredProfileRowSchema>;

export const ProviderRowSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  baseUrl: z.string().url().optional(),
  modelRoles: z.object({
    interviewer: z.string().min(1),
    evaluator: z.string().min(1),
  }),
  key: z.string().optional(),
  encryptedKey: z.string().optional(),
  lastTestedAt: z.string().datetime().optional(),
});
export type ProviderRow = z.infer<typeof ProviderRowSchema>;

export const SessionRowSchema = z.object({
  id: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  status: z.enum(["active", "completed", "abandoned"]),
  plan: z.unknown(),
  modality: z.enum(["voice", "text"]),
  level: ExperienceLevelSchema,
  companySlug: z.string().optional(),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  schemaVersion: z.number().int().positive(),
});
export type SessionRow = z.infer<typeof SessionRowSchema>;

export const TurnRowSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  index: z.number().int().nonnegative(),
  questionId: z.string().optional(),
  isUnverifiedQuestion: z.boolean(),
  skillTags: z.array(z.string()),
  difficulty: z.number().min(0).max(1),
  questionText: z.string().min(1),
  answerText: z.string(),
  followUpOf: z.string().optional(),
  evaluation: EvaluationSchema.optional(),
  delivery: DeliveryMetricsSchema.optional(),
  status: z.enum(["scored", "unscored"]),
});
export type TurnRow = z.infer<typeof TurnRowSchema>;

export const SkillStatRowSchema = z.object({
  skillId: z.string().min(1),
  score: z.number().min(0).max(100),
  n: z.number().int().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
  lastPracticedAt: z.string().datetime(),
  trend: z.number().optional(),
  taxonomyVersion: z.number().int().positive(),
});
export type SkillStatRow = z.infer<typeof SkillStatRowSchema>;

export const ReviewQueueRowSchema = z.object({
  id: z.string().min(1),
  turnId: z.string().min(1),
  dueAt: z.string().datetime(),
  intervalDays: z.number().int().positive(),
});
export type ReviewQueueRow = z.infer<typeof ReviewQueueRowSchema>;

export const SettingRowSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});
export type SettingRow = z.infer<typeof SettingRowSchema>;

export const CompanyCacheRowSchema = z.object({
  slug: z.string().min(1),
  pack: z.unknown(),
  fetchedAt: z.string().datetime(),
  packVersion: z.number().int().positive(),
});
export type CompanyCacheRow = z.infer<typeof CompanyCacheRowSchema>;

export const ModelRowSchema = z.object({
  id: z.string().min(1),
  engine: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  status: z.string().min(1),
  sanityResult: ModelSanityResultSchema.optional(),
  isCustom: z.boolean().optional(),
  format: z.string().optional(),
  gatedToken: z.string().optional(),
});
export type ModelRow = z.infer<typeof ModelRowSchema>;

export const QuarantineRowSchema = z.object({
  id: z.string().min(1),
  table: z.string().min(1),
  raw: z.unknown(),
  error: z.string(),
  at: z.string().datetime(),
});
export type QuarantineRow = z.infer<typeof QuarantineRowSchema>;
