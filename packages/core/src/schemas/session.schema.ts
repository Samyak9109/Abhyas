// FR-006, FR-007: Session plan schema and selected question types for M1.4.
// SessionPlan is the stable contract between session setup (PG-11) and the
// interview engine (M1.5). Add fields here; never remove without a migration.
import { z } from "zod";
import { ExperienceLevelSchema } from "./profile.schema.js";
import { QuestionTypeSchema } from "./question.schema.js";

// --- Session configuration -----------------------------------------------

export const InterviewerStyleSchema = z.enum(["friendly", "standard", "strict"]);
export type InterviewerStyle = z.infer<typeof InterviewerStyleSchema>;

export const InputModeSchema = z.enum(["text", "voice"]);
export type InputMode = z.infer<typeof InputModeSchema>;

export const SessionLengthSchema = z.union([z.literal(5), z.literal(10), z.literal(15)]);
export type SessionLength = z.infer<typeof SessionLengthSchema>;

// "mixed" means a proportional blend across all question types.
export const SessionTypeSchema = z.union([QuestionTypeSchema, z.literal("mixed")]);
export type SessionType = z.infer<typeof SessionTypeSchema>;

export const DrillFormatSchema = z.enum(["quick_fire", "deep_dive"]);
export type DrillFormat = z.infer<typeof DrillFormatSchema>;

// --- Session plan (the output of FR-006) ------------------------------------

/**
 * Stable contract produced by SessionSetupScreen and consumed by the interview
 * engine (M1.5) and question engine (FR-007). Fields must not be removed
 * without a storage migration; add new optional fields freely.
 */
export const SessionPlanSchema = z.object({
  /** Unique session identifier (crypto.randomUUID or test-provided). */
  sessionId: z.string().min(1),

  /** Interview type or "mixed" for a blended session. */
  type: SessionTypeSchema,

  /** Number of questions to ask. */
  length: SessionLengthSchema,

  /** Interviewer persona that controls tone and follow-up aggression. */
  style: InterviewerStyleSchema,

  /** Voice or text delivery. Voice requires device + AI support; validated before plan creation. */
  inputMode: InputModeSchema,

  /** Candidate's stated experience level, propagated from the profile. */
  level: ExperienceLevelSchema,

  /** Candidate's target role; used in AI personalization prompts. */
  targetRole: z.string().min(1).max(120),

  /** ISO 8601 timestamp when the plan was created. */
  createdAt: z.string().datetime(),

  /** Whether this session is a focused skill drill (FR-016). */
  isDrill: z.boolean().optional(),

  /** Skill ID targeted by this drill (FR-016). */
  targetSkillId: z.string().optional(),

  /** Drill format: "quick_fire" (short answers) or "deep_dive" (follow-up chains). */
  drillFormat: DrillFormatSchema.optional(),

  /** Whether the session runs on a local in-browser model (FR-022, ADR-013). */
  isLocalModel: z.boolean().optional(),

  /** Whether the session runs on a small model (AI-014). */
  isSmallModel: z.boolean().optional(),

  /** Target company slug if tailored to a company pack (FR-025). */
  companySlug: z.string().optional(),

  /** Target company display name if tailored to a company pack (FR-025). */
  companyName: z.string().optional(),
});

export type SessionPlan = z.infer<typeof SessionPlanSchema>;

// --- Question with personalization flag (the output of FR-007) ---------------

/**
 * A bank question selected and optionally personalized for a session.
 * `bankId` is present when the question comes from the curated bank (≥90%
 * in a 10-question session per the acceptance criteria). `isUnverified` is
 * true when the bank had no questions for a required skill and the question
 * was AI-generated; unverified questions are excluded from calibrated stats.
 */
export const SelectedQuestionSchema = z.object({
  /** Stable question ID from the bank, or a generated ID for AI questions. */
  id: z.string().min(1),

  /** Present when question traces to the curated bank. */
  bankId: z.string().optional(),

  /** True when AI-generated because no bank question matched the required skill. */
  isUnverified: z.boolean(),

  skillTags: z.array(z.string().min(1)).min(1),

  /** Normalized 0–1 difficulty (mapped from bank 1–5 to 0–1 for scoring). */
  difficulty: z.number().min(0).max(1),

  /** The question text shown to the candidate (may be AI-personalized). */
  text: z.string().min(10),

  /** Original bank question text before personalization, if applicable. */
  originalText: z.string().optional(),

  /** Rubric hints from the bank question for live hints and evaluation. */
  rubricHints: z.array(z.string()).optional(),

  /** Pre-authored follow-up questions from the bank question (if applicable). */
  followUps: z.array(z.string()).optional(),

  /** Reason this question was selected (for debugging and future analytics). */
  rationale: z.string().optional(),
});

export type SelectedQuestion = z.infer<typeof SelectedQuestionSchema>;
