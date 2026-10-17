// FR-004, FR-017, architecture.md 8 & 9: Calibration engine — level bands,
// adaptive difficulty stepping within bands, resume level detection, and gentle calibration notes.

import type { ExperienceLevel, StructuredProfile } from "../schemas/profile.schema.js";
import type { CalibrationAxes } from "../schemas/rubric.schema.js";
import type { CompletedTurn } from "../interview/state-machine.js";

// ---------------------------------------------------------------------------
// 1. Level Band Configurations
// ---------------------------------------------------------------------------

export interface LevelBandConfig {
  level: ExperienceLevel;
  label: string;
  yearsRange: [number, number];
  difficultyRange: [number, number]; // [minDifficulty, maxDifficulty] (1-5 integer scale)
  defaultDifficulty: number; // 1-5 integer scale
  description: string;
  axes: CalibrationAxes;
}

export const LEVEL_ORDER: readonly ExperienceLevel[] = [
  "intern_fresher",
  "junior",
  "mid",
  "senior",
  "staff_plus",
] as const;

export const LEVEL_BANDS: Record<ExperienceLevel, LevelBandConfig> = {
  intern_fresher: {
    level: "intern_fresher",
    label: "Intern / Fresher",
    yearsRange: [0, 1],
    difficultyRange: [1, 2],
    defaultDifficulty: 1,
    description:
      "Foundational level evaluating core CS fundamentals, algorithms, standard library idioms, and structured thinking without enterprise expectations.",
    axes: {
      depth:
        "Foundational understanding of core principles, basic CS fundamentals, standard libraries, and common algorithms.",
      ambiguity:
        "Low ambiguity expected; questions provide clear inputs, outputs, and constraints with immediate clarification available.",
      expectedScope:
        "Single function, module, or standard pattern scope; academic coursework or small project implementation.",
      followUpPressure:
        "Gentle, supportive probing to explore reasoning and verify that the candidate understands their chosen approach.",
      behavioralExpectations:
        "Demonstrates curiosity, humility, receptiveness to feedback, active learning, and structured communication of school or personal projects.",
    },
  },
  junior: {
    level: "junior",
    label: "Junior (1-3 yrs)",
    yearsRange: [1, 3],
    difficultyRange: [1, 3],
    defaultDifficulty: 2,
    description:
      "Junior engineering level focusing on practical software delivery, clean component implementation, testing, debugging, and bug triage.",
    axes: {
      depth:
        "Practical familiarity with language idioms, testing frameworks, standard APIs, database queries, and basic error handling.",
      ambiguity:
        "Moderate ambiguity; questions may require identifying typical missing requirements or common operational failure modes.",
      expectedScope:
        "Feature-level implementation, component architecture, API endpoints, bug triage, and small subsystem contributions.",
      followUpPressure:
        "Moderate follow-ups on testing edge cases, boundary conditions, failure scenarios, and code maintainability.",
      behavioralExpectations:
        "Demonstrates team collaboration, responsiveness to code reviews, proactive communication when blocked, and reliable execution.",
    },
  },
  mid: {
    level: "mid",
    label: "Mid-Level (3-5 yrs)",
    yearsRange: [3, 5],
    difficultyRange: [2, 4],
    defaultDifficulty: 3,
    description:
      "Autonomous engineer level evaluating system trade-offs, operational failure modes, schema indexing, and API idempotency.",
    axes: {
      depth:
        "Deep understanding of system mechanisms, indexing trade-offs, concurrency models, caching strategies, and service boundaries.",
      ambiguity:
        "High ambiguity; candidates are expected to ask clarifying questions, identify unstated constraints, and define boundaries.",
      expectedScope:
        "End-to-end service or subsystem ownership, data model durability, cross-service interactions, and operational monitoring.",
      followUpPressure:
        "Rigorous probing on operational trade-offs, latency degradation, database scaling limits, and fallback resilience.",
      behavioralExpectations:
        "Demonstrates autonomous ownership, constructive technical disagreement, cross-functional alignment, and mentoring of junior peers.",
    },
  },
  senior: {
    level: "senior",
    label: "Senior (5-8 yrs)",
    yearsRange: [5, 8],
    difficultyRange: [3, 5],
    defaultDifficulty: 4,
    description:
      "Senior engineer level evaluating distributed systems architecture, blast-radius containment, cross-team technical leadership, and production resilience.",
    axes: {
      depth:
        "Authoritative grasp of distributed systems invariants, consensus, partitioning, replication topologies, and disaster recovery.",
      ambiguity:
        "Very high ambiguity; requirements are deliberately incomplete, requiring candidate to frame the problem space strategically.",
      expectedScope:
        "Multi-system architecture, cross-team technical initiatives, company-wide libraries or frameworks, and incident post-mortems.",
      followUpPressure:
        "Intense, challenging probing on catastrophic failure modes, split-brain scenarios, thundering herds, and operational blast radius.",
      behavioralExpectations:
        "Demonstrates broad technical influence, organizational accountability, navigating ambiguous executive priorities, and multiplying senior peers.",
    },
  },
  staff_plus: {
    level: "staff_plus",
    label: "Staff+ (8+ yrs)",
    yearsRange: [8, 25],
    difficultyRange: [4, 5],
    defaultDifficulty: 5,
    description:
      "Staff/Principal level evaluating company-wide engineering strategy, organizational alignment, multi-year architecture roadmaps, and Conway's Law.",
    axes: {
      depth:
        "Strategic depth across enterprise systems, technology portfolio evaluation, cost/ROI models, and durable foundational paradigms.",
      ambiguity:
        "Extreme ambiguity; focuses on high-stakes business and organizational tensions with no clear single right answer.",
      expectedScope:
        "Organization-wide engineering strategy, platform architecture, technology migrations spanning multiple quarters, and governance.",
      followUpPressure:
        "Strategic probing on organizational resistance, Conway's Law friction, migration risk mitigation, and executive communication.",
      behavioralExpectations:
        "Exemplifies executive presence, organizational sponsorship, resolving toxic conflict, inspiring technical culture, and setting industry standards.",
    },
  },
};

export function getLevelIndex(level: ExperienceLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

// ---------------------------------------------------------------------------
// 2. Difficulty Conversions
// ---------------------------------------------------------------------------

/**
 * Converts integer difficulty (1 to 5) to normalized difficulty (0.0 to 1.0).
 */
export function difficultyBankToNorm(d: number): number {
  return Math.max(0, Math.min(1, (d - 1) / 4));
}

/**
 * Converts normalized difficulty (0.0 to 1.0) to integer difficulty (1 to 5).
 */
export function normToDifficultyBank(norm: number): number {
  return Math.max(1, Math.min(5, Math.round(norm * 4) + 1));
}

// ---------------------------------------------------------------------------
// 3. Adaptive Difficulty Stepping (FR-017, architecture.md 8)
// ---------------------------------------------------------------------------

/**
 * Computes the target integer difficulty (1-5) for the next question.
 *
 * Rules (architecture.md Section 8):
 * - Difficulty for the next question = previous difficulty ± 1, clamped to the level band (FR-017).
 * - Moves by at most one step per answer.
 * - Score >= 75%: step up +1 (clamped to level max).
 * - Score <= 45%: step down -1 (clamped to level min).
 * - Score in between: stay at current difficulty.
 */
export function computeAdaptiveDifficulty(
  currentDifficulty: number,
  lastTurn: CompletedTurn,
  level: ExperienceLevel
): number {
  const config = LEVEL_BANDS[level] ?? LEVEL_BANDS.mid;
  const [minD, maxD] = config.difficultyRange;

  // Clamped baseline
  const current = Math.max(minD, Math.min(maxD, Math.round(currentDifficulty)));

  if (lastTurn.status !== "scored" || !lastTurn.evaluation) {
    return current;
  }

  const c = lastTurn.evaluation.criteria;
  const mean =
    (c.relevance.score + c.structure.score + c.depth.score + c.clarity.score + c.levelFit.score) /
    5;
  const turnScore = Math.round(((mean - 1) / 4) * 100);

  let next = current;
  if (turnScore >= 75 || (c.levelFit.score >= 4 && c.depth.score >= 4)) {
    next = current + 1;
  } else if (turnScore <= 45 || c.levelFit.score <= 2) {
    next = current - 1;
  }

  // Ensure strict ±1 step bound and clamp to level range
  const clamped = Math.max(minD, Math.min(maxD, next));
  return clamped;
}

// ---------------------------------------------------------------------------
// 4. Resume-versus-Level Analysis (FR-004, FR-017)
// ---------------------------------------------------------------------------

export interface DetectedResumeLevel {
  detectedLevel: ExperienceLevel;
  estimatedYears: number;
  reason: string;
}

/**
 * Analyzes structured profile experiences and claims to estimate candidate experience level.
 */
export function detectResumeLevel(
  profile: StructuredProfile | null | undefined
): DetectedResumeLevel | null {
  if (!profile) return null;
  const experiences = profile.experiences || [];
  const claims = profile.quantifiedClaims || [];

  // 1. Look for explicit mentions of years of experience in claims and experiences
  let explicitYears: number | null = null;
  const yearRegex =
    /\b(\d{1,2})\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:professional\s+)?experience)?\b/i;

  for (const claim of claims) {
    const match = yearRegex.exec(claim);
    if (match && match[1]) {
      const yrs = parseInt(match[1], 10);
      if (!isNaN(yrs) && yrs > 0 && yrs <= 35) {
        if (explicitYears === null || yrs > explicitYears) {
          explicitYears = yrs;
        }
      }
    }
  }

  for (const exp of experiences) {
    for (const h of exp.highlights) {
      const match = yearRegex.exec(h);
      if (match && match[1]) {
        const yrs = parseInt(match[1], 10);
        if (!isNaN(yrs) && yrs > 0 && yrs <= 35) {
          if (explicitYears === null || yrs > explicitYears) {
            explicitYears = yrs;
          }
        }
      }
    }
  }

  // 2. Look for seniority signals in role titles
  const allRoles = experiences.map((e) => (e.role || "").toLowerCase());
  const hasStaffOrAbove = allRoles.some((r) =>
    /\b(staff|principal|director|head of|vp|distinguished|architect)\b/i.test(r)
  );
  const hasSenior = allRoles.some((r) => /\b(senior|sr\.|lead|team lead)\b/i.test(r));
  const hasJuniorOrInternOnly =
    allRoles.length > 0 &&
    allRoles.every((r) => /\b(intern|trainee|apprentice|student|associate|junior|jr\.)\b/i.test(r));

  let estimatedYears = 0;
  let reason = "";

  if (explicitYears !== null) {
    estimatedYears = explicitYears;
    reason = `Explicit resume statement: ${explicitYears} years of experience.`;
  } else if (hasStaffOrAbove) {
    estimatedYears = Math.max(8, experiences.length * 2.5);
    reason = "Leadership/Staff-level role titles in resume history.";
  } else if (hasSenior) {
    estimatedYears = Math.max(5, experiences.length * 2);
    reason = "Senior/Lead role titles in resume history.";
  } else if (hasJuniorOrInternOnly || experiences.length <= 1) {
    estimatedYears = experiences.length === 0 ? 0 : 1;
    reason = "Intern/Junior role titles or single entry in resume history.";
  } else {
    // Standard heuristics: ~1.5 years per distinct experience entry
    estimatedYears = Math.min(6, Math.max(1, Math.round(experiences.length * 1.5)));
    reason = `Estimated from ${experiences.length} experience entries.`;
  }

  // 3. Map estimated years to experience level
  let detectedLevel: ExperienceLevel;
  if (estimatedYears < 1) {
    detectedLevel = "intern_fresher";
  } else if (estimatedYears < 3) {
    detectedLevel = "junior";
  } else if (estimatedYears < 5) {
    detectedLevel = "mid";
  } else if (estimatedYears < 8) {
    detectedLevel = "senior";
  } else {
    detectedLevel = "staff_plus";
  }

  return { detectedLevel, estimatedYears, reason };
}

/**
 * Generates a gentle calibration note if the user's chosen interview level
 * differs noticeably (by 2 or more bands) from their resume evidence (FR-004, FR-017).
 * Never blocks the user or session.
 */
export function generateResumeVersusLevelNote(
  selectedLevel: ExperienceLevel,
  profile: StructuredProfile | null | undefined
): string | null {
  const detected = detectResumeLevel(profile);
  if (!detected) return null;

  const selectedIdx = getLevelIndex(selectedLevel);
  const detectedIdx = getLevelIndex(detected.detectedLevel);
  const diff = selectedIdx - detectedIdx;

  // Differences of < 2 bands (e.g. Junior vs Mid, Mid vs Senior) are considered normal variance.
  if (Math.abs(diff) < 2) {
    return null;
  }

  const selectedConfig = LEVEL_BANDS[selectedLevel];
  const detectedConfig = LEVEL_BANDS[detected.detectedLevel];

  if (diff >= 2) {
    // User selected much higher level than resume evidence
    const yrText =
      detected.estimatedYears <= 1 ? "under a year" : `about ${detected.estimatedYears} years`;
    return `Your resume suggests ${yrText} of experience, whereas this session was conducted at the ${selectedConfig.label} level. While practicing higher is excellent for stretching, calibrating at ${detectedConfig.label} will provide feedback directly tailored to your immediate target roles.`;
  }

  // User selected much lower level than resume evidence (e.g. Senior practicing at Intern level)
  return `Your resume reflects approximately ${detected.estimatedYears} years of experience, but you practiced at the ${selectedConfig.label} level. Practicing at ${detectedConfig.label} will test the architectural trade-offs and leadership scope expected for your background.`;
}
