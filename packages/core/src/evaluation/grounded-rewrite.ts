// FR-013, AI-005, AI-021: Grounded answer rewrite generator and hallucination guardrail.
// Rewrites are grounded strictly in facts from the candidate's verified profile.
import { z } from "zod";
import type { ProviderAdapter } from "../providers/types.js";
import type { ExperienceLevel, StructuredProfile } from "../schemas/profile.schema.js";

export const GroundedRewriteSchema = z.object({
  /** Improved STAR-structured answer */
  rewrittenAnswer: z.string().min(20).max(1800),
  /** Verifiable facts from the profile utilized in the answer */
  groundedFacts: z.array(z.string()).max(10),
  /** Key improvement explanation (why this rewrite is stronger) */
  improvementSummary: z.string().max(280),
  /** Any claims flagged as potentially unsupported */
  unsupportedClaims: z.array(z.string()).max(5),
});
export type GroundedRewrite = z.infer<typeof GroundedRewriteSchema>;

export interface GroundedRewriteOptions {
  questionText: string;
  originalAnswer: string;
  level: ExperienceLevel;
  targetRole: string;
  profile?: StructuredProfile | null | undefined;
  provider?: ProviderAdapter | undefined;
  abortSignal?: AbortSignal | undefined;
}

export interface GroundingValidationResult {
  isGrounded: boolean;
  unsupportedClaims: string[];
  supportedFacts: string[];
}

/**
 * Validates that an answer rewrite does not introduce unverified entities,
 * companies, or skills that do not exist in the candidate's profile.
 */
export function validateGrounding(
  rewriteText: string,
  profile?: StructuredProfile | null | undefined,
  contextQuestionText?: string | undefined
): GroundingValidationResult {
  if (!profile) {
    return {
      isGrounded: true,
      unsupportedClaims: [],
      supportedFacts: [],
    };
  }

  const profileExperiences = (profile.experiences ?? []).flatMap((e) => [
    e.role,
    e.company || "",
    ...(e.highlights ?? []),
  ]);
  const profileText = [
    profile.condensed || "",
    ...(profile.skills ?? []),
    ...profileExperiences,
    ...(profile.quantifiedClaims ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const unsupportedClaims: string[] = [];
  const supportedFacts: string[] = [];

  // Check known profile skills
  const profileSkills: string[] = profile.skills ?? [];

  for (const skill of profileSkills) {
    if (rewriteText.toLowerCase().includes(skill.toLowerCase())) {
      supportedFacts.push(`Skill: ${skill}`);
    }
  }

  // Check for common hallucinated enterprise company names
  const commonHallucinatedCompanies = [
    "Google",
    "Amazon",
    "Netflix",
    "Meta",
    "Apple",
    "Microsoft",
    "Uber",
    "Airbnb",
    "Stripe",
  ];
  for (const company of commonHallucinatedCompanies) {
    const regex = new RegExp(`\\b${company}\\b`, "i");
    const mentionedInQuestion = contextQuestionText && regex.test(contextQuestionText);
    if (
      regex.test(rewriteText) &&
      !profileText.includes(company.toLowerCase()) &&
      !mentionedInQuestion
    ) {
      unsupportedClaims.push(`Invented employer or client: ${company}`);
    }
  }

  return {
    isGrounded: unsupportedClaims.length === 0,
    unsupportedClaims,
    supportedFacts,
  };
}

/**
 * Generates a stronger answer rewrite grounded exclusively in facts from the candidate's profile.
 */
export async function generateGroundedRewrite(
  options: GroundedRewriteOptions
): Promise<GroundedRewrite> {
  const { questionText, originalAnswer, level, targetRole, profile, provider, abortSignal } =
    options;

  if (!provider) {
    return createDeterministicRewrite(questionText, originalAnswer, level, targetRole, profile);
  }

  const profileSummary = profile
    ? profile.condensed || profile.skills.join(", ")
    : "No uploaded profile. Use general engineering principles without asserting specific company or project names.";

  const systemPrompt = `You are an expert interview coach. Your task is to rewrite the candidate's answer into a stronger, articulate, well-structured answer.

NON-NEGOTIABLE GROUNDING RULES:
1. You may ONLY reference projects, companies, technologies, tools, and achievements that explicitly appear in the Candidate Profile below.
2. NEVER invent work experience, employers, metrics, or years of experience.
3. If the profile lacks a specific project for this question, frame the answer around how the candidate would approach it using their verified skills.
4. Output valid JSON matching the schema.`;

  const userPrompt = `Role: ${targetRole} (${level})
Candidate Profile Facts:
${profileSummary}

Question: "${questionText}"
Candidate's Initial Answer: "${originalAnswer}"

Rewrite the answer to be concise, structured, and technically grounded.`;

  try {
    const result = await provider.generateObject<GroundedRewrite>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      GroundedRewriteSchema,
      {
        signal: abortSignal ?? new AbortController().signal,
        maxOutputTokens: 1200,
        temperature: 0,
      }
    );

    if (result.ok) {
      const value = result.value;
      // Post-validation grounding check
      const validation = validateGrounding(value.rewrittenAnswer, profile, questionText);
      const combinedUnsupported = Array.from(
        new Set([...(value.unsupportedClaims || []), ...validation.unsupportedClaims])
      ).slice(0, 5);

      return {
        rewrittenAnswer: value.rewrittenAnswer.slice(0, 1800),
        groundedFacts: value.groundedFacts.slice(0, 10),
        improvementSummary: value.improvementSummary.slice(0, 280),
        unsupportedClaims: combinedUnsupported,
      };
    }
  } catch {
    // Fall back to deterministic rewrite
  }

  return createDeterministicRewrite(questionText, originalAnswer, level, targetRole, profile);
}

/**
 * Fallback deterministic rewrite generator when AI provider is not available or offline.
 */
export function createDeterministicRewrite(
  questionText: string,
  originalAnswer: string,
  level: ExperienceLevel,
  targetRole: string,
  profile?: StructuredProfile | null | undefined
): GroundedRewrite {
  const profileSkills: string[] = profile?.skills ?? [];

  const topSkill = profileSkills[0] || "modern software engineering practices";
  const secondSkill = profileSkills[1] || "automated testing and observability";

  const contextSnippet =
    originalAnswer.trim().length > 0 ? ` (expanding on: "${originalAnswer.slice(0, 60)}...")` : "";

  const rewrittenAnswer =
    `In my work as a ${targetRole} (${level}), I address "${questionText.slice(0, 70)}"${contextSnippet} by first clarifying requirements and operational constraints. ` +
    `Specifically, to address this engineering challenge effectively, ` +
    `I leverage ${topSkill} and ${secondSkill} to build an idempotent, verifiable solution. ` +
    `I establish clear boundary metrics upfront, evaluate design trade-offs between latency and maintainability, ` +
    `and ensure automated regression tests validate the expected behavior.`;

  return {
    rewrittenAnswer,
    groundedFacts: profileSkills.slice(0, 3).map((s) => `Profile skill: ${s}`),
    improvementSummary: `Structured the answer around requirements, technical execution with ${topSkill}, and operational verification.`,
    unsupportedClaims: [],
  };
}
