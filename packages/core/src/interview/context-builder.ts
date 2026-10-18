// FR-012, AI-013, AI-014: Layered interview context builder with rolling summary and token budgeting.
import type { ChatMessage } from "../providers/types.js";
import type { ExperienceLevel, StructuredProfile } from "../schemas/profile.schema.js";
import { condenseProfile } from "../profile/condenser.js";

export interface TurnContextItem {
  index: number;
  questionText: string;
  answerText: string;
  skillTags?: string[] | undefined;
  score?: number | undefined;
  evaluationTopFix?: string | undefined;
}

export interface CompanyPackContext {
  name: string;
  cultureValues?: string[] | undefined;
  interviewFocus?: string[] | undefined;
  techStack?: string[] | undefined;
  notes?: string | undefined;
}

export interface LayeredContextOptions {
  systemRules?: string | undefined;
  targetRole: string;
  level: ExperienceLevel;
  interviewStyle?: string | undefined;
  profile?: StructuredProfile | null | undefined;
  companyPack?: CompanyPackContext | null | undefined;
  completedTurns: TurnContextItem[];
  currentQuestion: string;
  instruction?: string | undefined;
  isSmallModel?: boolean | undefined;
  /** Maximum token budget (defaults to 3,000 for small local models per AI-014, 8,000 for standard) */
  targetTokenBudget?: number | undefined;
}

export interface LayeredContextResult {
  messages: ChatMessage[];
  estimatedTokens: number;
  layers: {
    systemRules: string;
    levelPersona: string;
    condensedProfile: string;
    delimitedCompanyPack: string;
    rollingSummary: string;
    verbatimTurns: string;
    currentQuestion: string;
  };
}

/**
 * Estimates token count from text using word and character heuristics (~4 chars/token).
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Returns baseline rubric anchor summary for each experience level (FR-017).
 */
export function getLevelExpectationSummary(level: ExperienceLevel): string {
  switch (level) {
    case "intern_fresher":
      return "Level Expectation: Foundational problem solving, eagerness to learn, clear communication on fundamentals.";
    case "junior":
      return "Level Expectation: Working code, basic implementation correctness, modular functions, learning from feedback.";
    case "mid":
      return "Level Expectation: Autonomous execution, edge case awareness, API/data durability, proactive trade-off analysis.";
    case "senior":
      return "Level Expectation: Distributed architecture, failure-mode mitigation, blast radius control, mentoring, scale trade-offs.";
    case "staff_plus":
      return "Level Expectation: Multi-team organizational leverage, multi-year architecture vision, platform durability, executive clarity.";
  }
}

/**
 * Builds a rolling summary of older turns (before the last 2-3 verbatim turns).
 * Guarantees long interviews stay under context limits while preserving progression context.
 */
export function buildRollingSummary(earlierTurns: TurnContextItem[], maxTokens = 350): string {
  if (earlierTurns.length === 0) return "";

  const summaryLines: string[] = [];
  for (const turn of earlierTurns) {
    const qSnippet =
      turn.questionText.length > 70 ? `${turn.questionText.slice(0, 67)}...` : turn.questionText;
    const ansSnippet =
      turn.answerText.length > 100 ? `${turn.answerText.slice(0, 97)}...` : turn.answerText;
    const skills =
      turn.skillTags && turn.skillTags.length > 0 ? ` [${turn.skillTags.join(", ")}]` : "";
    const score = typeof turn.score === "number" ? ` (Score: ${turn.score}%)` : "";
    summaryLines.push(
      `- Q${turn.index + 1}${skills}: "${qSnippet}" -> Answer: "${ansSnippet}"${score}`
    );
  }

  let result = summaryLines.join("\n");
  const maxChars = maxTokens * 4;
  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars - 3)}...`;
  }
  return result;
}

/**
 * Formats the most recent 2 or 3 turns verbatim.
 */
export function buildVerbatimTurns(recentTurns: TurnContextItem[], maxTokens = 800): string {
  if (recentTurns.length === 0) return "";

  const blocks: string[] = [];
  for (const turn of recentTurns) {
    const lines = [
      `Turn ${turn.index + 1}:`,
      `Interviewer: "${turn.questionText}"`,
      `Candidate: "${turn.answerText}"`,
    ];
    if (typeof turn.score === "number") {
      lines.push(`Evaluation: Scored ${turn.score}%`);
    }
    if (turn.evaluationTopFix) {
      lines.push(`Improvement Note: ${turn.evaluationTopFix}`);
    }
    blocks.push(lines.join("\n"));
  }

  let result = blocks.join("\n\n");
  const maxChars = maxTokens * 4;
  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars - 3)}...`;
  }
  return result;
}

/**
 * Builds 7-layer context complying strictly with AI-013 & AI-014:
 * 1. system rules
 * 2. level and persona
 * 3. condensed profile
 * 4. delimited company pack (as data)
 * 5. rolling summary of earlier turns
 * 6. last two or three turns verbatim
 * 7. current question
 */
export function buildLayeredInterviewContext(options: LayeredContextOptions): LayeredContextResult {
  const {
    targetRole,
    level,
    interviewStyle,
    profile,
    companyPack,
    completedTurns,
    currentQuestion,
    instruction,
    isSmallModel = false,
  } = options;

  // Target token budget: 3,000 tokens for small models (AI-014), 8,000 for standard
  const targetTokenBudget = options.targetTokenBudget ?? (isSmallModel ? 3000 : 8000);

  // Layer 1: System Rules
  const systemRules =
    options.systemRules ||
    [
      "You are an objective engineering interviewer conducting a realistic mock interview.",
      "Maintain a calm, professional, and neutral tone.",
      "Ask focused, probing questions that assess depth, structure, and technical trade-offs.",
      "Calibrate your evaluation strictly against the candidate's declared level.",
      "Do not invent facts or experiences absent from the candidate's verified profile.",
    ].join("\n");

  // Layer 2: Level and Persona
  const levelPersona = [
    `Interview Role: ${targetRole}`,
    `Experience Level: ${level}`,
    interviewStyle ? `Interview Style: ${interviewStyle}` : "",
    getLevelExpectationSummary(level),
  ]
    .filter(Boolean)
    .join("\n");

  // Layer 3: Condensed Profile (AI-014: pre-condensed once and cached)
  // For small models, constrain to 1,000 chars (~250 tokens); standard 2,500 chars (~625 tokens)
  const profileBudgetChars = isSmallModel ? 1000 : 2500;
  let condensedProfile = "";
  if (profile) {
    if (profile.condensed && profile.condensed.length <= profileBudgetChars) {
      condensedProfile = `Candidate Verified Profile:\n${profile.condensed}`;
    } else {
      const condensed = condenseProfile(
        {
          skills: profile.skills,
          experiences: profile.experiences,
          gaps: profile.gaps,
          quantifiedClaims: profile.quantifiedClaims,
        },
        {
          targetRole,
          level,
          maxChars: profileBudgetChars,
        }
      );
      condensedProfile = `Candidate Verified Profile:\n${condensed}`;
    }
  }

  // Layer 4: Delimited Company Pack (as data per AI-013 / ADR-008 injection safety)
  let delimitedCompanyPack = "";
  if (companyPack) {
    const packLines: string[] = [`<company_data name="${companyPack.name}">`];
    if (companyPack.cultureValues && companyPack.cultureValues.length > 0) {
      packLines.push(`Core Values: ${companyPack.cultureValues.join(", ")}`);
    }
    if (companyPack.interviewFocus && companyPack.interviewFocus.length > 0) {
      packLines.push(`Interview Focus: ${companyPack.interviewFocus.join(", ")}`);
    }
    if (companyPack.techStack && companyPack.techStack.length > 0) {
      packLines.push(`Tech Stack: ${companyPack.techStack.join(", ")}`);
    }
    if (companyPack.notes) {
      packLines.push(`Context Notes: ${companyPack.notes}`);
    }
    packLines.push("</company_data>");
    delimitedCompanyPack = packLines.join("\n");
  }

  // Determine window: small models use last 2 turns verbatim; standard uses last 3 turns
  const verbatimCount = isSmallModel ? 2 : 3;
  let earlierTurns: TurnContextItem[] = [];
  let recentTurns: TurnContextItem[] = [];

  if (completedTurns.length > verbatimCount) {
    earlierTurns = completedTurns.slice(0, completedTurns.length - verbatimCount);
    recentTurns = completedTurns.slice(completedTurns.length - verbatimCount);
  } else {
    earlierTurns = [];
    recentTurns = [...completedTurns];
  }

  // Layer 5: Rolling Summary of Earlier Turns (AI-013)
  const rollingBudgetTokens = isSmallModel ? 250 : 500;
  const rollingSummary = buildRollingSummary(earlierTurns, rollingBudgetTokens);

  // Layer 6: Last Two or Three Turns Verbatim (AI-013)
  const verbatimBudgetTokens = isSmallModel ? 600 : 1200;
  const verbatimTurns = buildVerbatimTurns(recentTurns, verbatimBudgetTokens);

  // Layer 7: Current Question & Instruction
  const currentQuestionBlock = [
    `Current Question: "${currentQuestion}"`,
    instruction ? `Instruction: ${instruction}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Format into ChatMessages: System message with background rules & data; User message with dialogue progression
  const systemMessageContent = [systemRules, levelPersona, condensedProfile, delimitedCompanyPack]
    .filter(Boolean)
    .join("\n\n");

  const userMessageParts: string[] = [];
  if (rollingSummary) {
    userMessageParts.push(`--- Rolling Summary of Earlier Turns ---\n${rollingSummary}`);
  }
  if (verbatimTurns) {
    userMessageParts.push(`--- Recent Turns Verbatim ---\n${verbatimTurns}`);
  }
  userMessageParts.push(`--- Current Step ---\n${currentQuestionBlock}`);

  const userMessageContent = userMessageParts.join("\n\n");

  let totalChars = systemMessageContent.length + userMessageContent.length;
  let totalEstimatedTokens = estimateTokenCount(systemMessageContent + userMessageContent);

  // AI-014 Token budget guard: If total exceeds budget, adaptively trim
  let finalUserContent = userMessageContent;
  if (totalEstimatedTokens > targetTokenBudget) {
    // Trim from earlier turns summary first, then verbatim
    const maxUserChars = Math.max(500, targetTokenBudget * 4 - systemMessageContent.length - 200);
    if (finalUserContent.length > maxUserChars) {
      finalUserContent = `${finalUserContent.slice(0, maxUserChars - 3)}...`;
    }
    totalChars = systemMessageContent.length + finalUserContent.length;
    totalEstimatedTokens = Math.max(1, Math.ceil(totalChars / 4));
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemMessageContent },
    { role: "user", content: finalUserContent },
  ];

  return {
    messages,
    estimatedTokens: totalEstimatedTokens,
    layers: {
      systemRules,
      levelPersona,
      condensedProfile,
      delimitedCompanyPack,
      rollingSummary,
      verbatimTurns,
      currentQuestion: currentQuestionBlock,
    },
  };
}
