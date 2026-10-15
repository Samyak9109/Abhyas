// FR-007, AI-002: Question engine — bank selection, difficulty weighting,
// repeat avoidance, and AI personalization.
//
// Design constraints (from PRD section 6, FR-007):
// - Select from curated tagged bank weighted by JD gaps and weak skills.
// - AI only personalizes phrasing; it never assigns difficulty.
// - Avoid repeats from the last 3 sessions when the bank allows.
// - If the bank is empty for a required skill, emit an AI-generated question
//   flagged `isUnverified: true`, excluded from calibrated stats.
// - ≥90% of questions in a 10-question session must trace to bank IDs.
// - Seeded PRNG for deterministic replay in tests (pass `rng` override).

import { z } from "zod";
import {
  type Question,
  type QuestionBank,
  type SessionPlan,
  type SelectedQuestion,
  SelectedQuestionSchema,
} from "../schemas/index.js";
import type { StructuredProfile } from "../schemas/profile.schema.js";
import type { ProviderAdapter } from "../providers/types.js";

// ---------------------------------------------------------------------------
// Seeded PRNG — Mulberry32, public domain.
// Returns a deterministic [0, 1) float from a 32-bit seed.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed;
  return function (): number {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic seed from a string (djb2).
function seedFromString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Fisher–Yates shuffle using the provided PRNG.
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Difficulty mapping helpers
// ---------------------------------------------------------------------------

const LEVEL_DIFFICULTY_RANGE: Record<string, [number, number]> = {
  intern_fresher: [1, 2],
  junior: [1, 3],
  mid: [2, 4],
  senior: [3, 5],
  staff_plus: [4, 5],
};

const LEVEL_DEFAULT_DIFFICULTY: Record<string, number> = {
  intern_fresher: 1,
  junior: 2,
  mid: 3,
  senior: 4,
  staff_plus: 5,
};

function difficultyBankToNorm(d: number): number {
  // Bank: 1–5 integer → normalized 0–1 for scoring.
  return (d - 1) / 4;
}

// ---------------------------------------------------------------------------
// Weighting
// ---------------------------------------------------------------------------

/**
 * Assign a selection weight to a bank question for a given session.
 * Higher weight = more likely to be selected.
 *
 * Weights are intentionally simple: multiply bonus factors rather than
 * computing a complex score. The AI personalizes afterward.
 */
function computeWeight(
  question: Question,
  plan: SessionPlan,
  gapSkills: Set<string>,
  weakSkills: Set<string>
): number {
  const [minD, maxD] = LEVEL_DIFFICULTY_RANGE[plan.level] ?? [1, 5];

  // Questions outside the level difficulty window score 0 (not eligible).
  if (question.difficulty < minD || question.difficulty > maxD) return 0;

  let weight = 1.0;

  // JD gaps get the highest boost — they address explicit requirement gaps.
  const hasGapSkill = question.skillTags.some((t) => gapSkills.has(t));
  if (hasGapSkill) weight *= 2.5;

  // Weak skills from prior sessions boost selection (FR-007 spec).
  const hasWeakSkill = question.skillTags.some((t) => weakSkills.has(t));
  if (hasWeakSkill) weight *= 1.8;

  return weight;
}

// ---------------------------------------------------------------------------
// Type-filtering helpers
// ---------------------------------------------------------------------------

const TYPE_FILTER: Record<string, (q: Question) => boolean> = {
  behavioral: (q) => q.type === "behavioral",
  technical: (q) => q.type === "technical",
  system_design: (q) => q.type === "system_design",
  dsa_verbal: (q) => q.type === "dsa_verbal",
  mixed: () => true,
};

// For mixed sessions, distribute evenly across the 4 question types.
const MIXED_TYPES: Array<Question["type"]> = [
  "behavioral",
  "technical",
  "system_design",
  "dsa_verbal",
];

// ---------------------------------------------------------------------------
// AI personalization
// ---------------------------------------------------------------------------

const PersonalizationOutputSchema = z.object({
  personalizedText: z.string().min(10),
});
type PersonalizationOutput = z.infer<typeof PersonalizationOutputSchema>;

const PERSONALIZATION_SYSTEM_PROMPT = `You are an expert interview coach helping personalize question phrasing.
Given a candidate profile and an original question, rewrite the question to:
- Reference the candidate's specific experience level and target role naturally.
- Keep the core technical/behavioral intent unchanged.
- Maintain the same difficulty.
- Stay concise (one to two sentences maximum).
Return a JSON object with a single "personalizedText" field containing the rewritten question.`;

async function personalizeQuestion(
  originalText: string,
  plan: SessionPlan,
  profile: StructuredProfile | null,
  adapter: ProviderAdapter
): Promise<string> {
  const profileContext = profile
    ? `Candidate: ${plan.level} ${plan.targetRole}. Skills: ${profile.skills.slice(0, 8).join(", ")}.`
    : `Candidate: ${plan.level} ${plan.targetRole}.`;

  try {
    const controller = new AbortController();
    const res = await adapter.generateObject<PersonalizationOutput>(
      [
        { role: "system", content: PERSONALIZATION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `${profileContext}\n\nOriginal question: "${originalText}"`,
        },
      ],
      PersonalizationOutputSchema,
      {
        signal: controller.signal,
        maxOutputTokens: 200,
        temperature: 0.3,
      }
    );

    if (res.ok && res.value.personalizedText) {
      const text = res.value.personalizedText.trim();
      return text.length >= 10 ? text : originalText;
    }
    return originalText;
  } catch {
    // Any AI failure falls back to the original text.
    return originalText;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SelectQuestionsOptions {
  plan: SessionPlan;
  bank: QuestionBank;

  /** Structured profile for gap and weak-skill weighting; null for role-only mode. */
  profile: StructuredProfile | null;

  /** Skill IDs from prior sessions with low scores (for weak-skill weighting). */
  weakSkillIds?: string[];

  /** Question IDs used in the last 3 sessions (repeat avoidance). */
  recentQuestionIds?: string[];

  /**
   * Optional provider adapter for AI personalization (AI-002).
   * If omitted or unavailable, the original bank text is used.
   */
  adapter?: ProviderAdapter;

  /**
   * PRNG factory override for deterministic tests.
   * Receives the session seed and returns a [0, 1) float generator.
   */
  rng?: (seed: number) => () => number;

  /**
   * Optional AI question generator for the "unverified" fallback when the
   * bank is empty for a required skill. If omitted, the fallback generates a
   * plain-text question without AI.
   */
  generateFallback?: (skill: string, plan: SessionPlan) => Promise<string>;
}

export interface SelectQuestionsResult {
  questions: SelectedQuestion[];
  /** Number of questions that trace to a bank ID (for the ≥90% AC check). */
  bankTracedCount: number;
  /** Number of AI-generated unverified questions emitted. */
  unverifiedCount: number;
}

/**
 * Select `plan.length` questions from the bank, applying:
 * 1. Type filter (or proportional mix for "mixed").
 * 2. Level-based difficulty window.
 * 3. Weighted sampling (gap > weak-skill > neutral).
 * 4. Repeat deduplication against `recentQuestionIds`.
 * 5. Optional AI personalization of question text.
 * 6. Unverified AI fallback when the bank has no eligible questions for a slot.
 */
export async function selectQuestions(
  opts: SelectQuestionsOptions
): Promise<SelectQuestionsResult> {
  const { plan, bank, profile, adapter } = opts;
  const weakSkills = new Set(opts.weakSkillIds ?? []);
  const recentIds = new Set(opts.recentQuestionIds ?? []);
  const rngFactory = opts.rng ?? mulberry32;
  const rng = rngFactory(seedFromString(plan.sessionId));

  const gapSkills = new Set(profile?.gaps ?? []);

  // --- Build the eligible question pool -----------------------------------

  const typeFilter = TYPE_FILTER[plan.type] ?? (() => true);

  const eligible = bank.filter(
    (q) => typeFilter(q) && computeWeight(q, plan, gapSkills, weakSkills) > 0
  );

  // Deduplicate against recent sessions (soft: if pool too small, allow repeats).
  const nonRecent = eligible.filter((q) => !recentIds.has(q.id));
  const pool = nonRecent.length >= plan.length ? nonRecent : eligible;

  // --- Weighted sampling ---------------------------------------------------

  const weights = pool.map((q) => computeWeight(q, plan, gapSkills, weakSkills));
  const selected: Question[] = [];
  const usedIds = new Set<string>();

  // For "mixed", try to pick proportionally across types.
  if (plan.type === "mixed") {
    const perType = Math.ceil(plan.length / MIXED_TYPES.length);
    for (const t of MIXED_TYPES) {
      const typePool = pool.filter((q) => q.type === t && !usedIds.has(q.id));
      const typeWeights = typePool.map((q) => computeWeight(q, plan, gapSkills, weakSkills));
      const picks = weightedSample(typePool, typeWeights, perType, rng);
      for (const p of picks) {
        if (selected.length < plan.length) {
          selected.push(p);
          usedIds.add(p.id);
        }
      }
    }
    // Fill remaining from the full pool.
    if (selected.length < plan.length) {
      const remaining = pool.filter((q) => !usedIds.has(q.id));
      const remWeights = remaining.map((q) => computeWeight(q, plan, gapSkills, weakSkills));
      const fill = weightedSample(remaining, remWeights, plan.length - selected.length, rng);
      for (const q of fill) {
        selected.push(q);
        usedIds.add(q.id);
      }
    }
  } else {
    const picks = weightedSample(pool, weights, plan.length, rng);
    for (const q of picks) {
      selected.push(q);
      usedIds.add(q.id);
    }
  }

  // --- Unverified fallback for missing slots --------------------------------

  const unverifiedTexts: string[] = [];
  let slotsNeeded = plan.length - selected.length;
  while (slotsNeeded > 0) {
    const fallbackSkill =
      [...gapSkills][unverifiedTexts.length % Math.max(gapSkills.size, 1)] ?? plan.targetRole;
    const text = opts.generateFallback
      ? await opts.generateFallback(fallbackSkill, plan)
      : `Tell me about your experience with ${fallbackSkill} as it relates to your role as a ${plan.targetRole}.`;
    unverifiedTexts.push(text);
    slotsNeeded--;
  }

  // --- Shuffle final order -------------------------------------------------

  const shuffledBank = shuffle(selected, rng);

  // --- AI personalization ---------------------------------------------------

  const finalQuestions: SelectedQuestion[] = [];

  for (const q of shuffledBank) {
    let text = q.text;
    let originalText: string | undefined;

    if (adapter) {
      const personalized = await personalizeQuestion(q.text, plan, profile, adapter);
      if (personalized !== q.text) {
        originalText = q.text;
        text = personalized;
      }
    }

    finalQuestions.push(
      SelectedQuestionSchema.parse({
        id: q.id,
        bankId: q.id,
        isUnverified: false,
        skillTags: q.skillTags,
        difficulty: difficultyBankToNorm(q.difficulty),
        text,
        ...(originalText ? { originalText } : {}),
        ...(q.rubricHints ? { rubricHints: q.rubricHints } : {}),
        rationale: `Level ${q.difficulty} ${q.type} matching ${q.skillTags.join(", ")}`,
      })
    );
  }

  // Append unverified fallback questions.
  for (let i = 0; i < unverifiedTexts.length; i++) {
    finalQuestions.push(
      SelectedQuestionSchema.parse({
        id: `unverified-${plan.sessionId}-${i}`,
        isUnverified: true,
        skillTags:
          [...gapSkills].slice(0, 1).length > 0
            ? [[...gapSkills][0]!]
            : [plan.targetRole.toLowerCase().replace(/\s+/g, "_")],
        difficulty: difficultyBankToNorm(LEVEL_DEFAULT_DIFFICULTY[plan.level] ?? 3),
        text: unverifiedTexts[i]!,
        rationale: "AI-generated: no bank question matched required skill",
      })
    );
  }

  const bankTracedCount = finalQuestions.filter((q) => q.bankId !== undefined).length;
  const unverifiedCount = finalQuestions.filter((q) => q.isUnverified).length;

  return { questions: finalQuestions, bankTracedCount, unverifiedCount };
}

// ---------------------------------------------------------------------------
// Weighted sample without replacement
// ---------------------------------------------------------------------------

function weightedSample<T>(items: T[], weights: number[], count: number, rng: () => number): T[] {
  if (items.length === 0) return [];
  const result: T[] = [];
  const remaining = items.slice();
  const rem_w = weights.slice();

  const n = Math.min(count, items.length);
  for (let i = 0; i < n; i++) {
    const total = rem_w.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      // All weights are zero — fall back to uniform.
      const idx = Math.floor(rng() * remaining.length);
      result.push(remaining[idx]!);
      remaining.splice(idx, 1);
      rem_w.splice(idx, 1);
    } else {
      let r = rng() * total;
      let idx = 0;
      while (idx < rem_w.length - 1 && r > rem_w[idx]!) {
        r -= rem_w[idx]!;
        idx++;
      }
      result.push(remaining[idx]!);
      remaining.splice(idx, 1);
      rem_w.splice(idx, 1);
    }
  }

  return result;
}
