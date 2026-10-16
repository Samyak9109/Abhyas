// FR-014, ADR-006: Canonical skill taxonomy definitions, categories, and lookup accessors.
import {
  TaxonomySchema,
  type SkillCategory,
  type SkillDefinition,
  type Taxonomy,
} from "@abhyas/core";

export const CANONICAL_TAXONOMY: Taxonomy = TaxonomySchema.parse({
  version: 1,
  skills: [
    {
      id: "dsa",
      name: "Data Structures & Algorithms",
      category: "technical",
      description:
        "Algorithmic problem-solving, asymptotic complexity analysis, graph/tree traversals, and dynamic programming.",
    },
    {
      id: "system_design",
      name: "System Design & Architecture",
      category: "technical",
      description:
        "Distributed systems, architectural trade-offs, scalability, data partitioning, caching, and fault tolerance.",
    },
    {
      id: "databases",
      name: "Databases & Storage",
      category: "technical",
      description:
        "Relational and non-relational database design, query optimization, indexing strategies, and transactional semantics.",
    },
    {
      id: "backend_apis",
      name: "Backend & API Engineering",
      category: "technical",
      description:
        "REST and RPC API design, service architecture, idempotency, authentication, rate limiting, and contract durability.",
    },
    {
      id: "frontend",
      name: "Frontend & Web Engineering",
      category: "technical",
      description:
        "Component architecture, browser performance, accessibility (WCAG AA), DOM lifecycle, and UI state management.",
    },
    {
      id: "ml_ai",
      name: "Machine Learning & AI",
      category: "technical",
      description:
        "Model selection, inference pipelines, embeddings, prompt engineering, evaluation metrics, and guardrail design.",
    },
    {
      id: "cloud_devops",
      name: "Cloud & DevOps",
      category: "technical",
      description:
        "CI/CD automation, cloud infrastructure, observability (metrics, logs, traces), and operational reliability.",
    },
    {
      id: "language_specific",
      name: "Language Idioms & Internals",
      category: "technical",
      description:
        "Deep understanding of language semantics, runtime internals, memory layout, concurrency primitives, and type safety.",
    },
    {
      id: "communication",
      name: "Structured Communication",
      category: "behavioral",
      description:
        "Structured articulation using frameworks such as STAR, concise executive summaries, and clear explanation of complex ideas.",
    },
    {
      id: "ownership",
      name: "Ownership & Initiative",
      category: "behavioral",
      description:
        "Taking end-to-end accountability, navigating ambiguity proactively, learning from mistakes, and seeing projects through to launch.",
    },
    {
      id: "conflict",
      name: "Conflict Resolution & Alignment",
      category: "behavioral",
      description:
        "Navigating disagreements constructively, finding principled compromise, disagreeing and committing, and cross-functional alignment.",
    },
    {
      id: "leadership",
      name: "Technical Leadership & Mentorship",
      category: "behavioral",
      description:
        "Guiding technical decisions, mentoring junior engineers, setting engineering standards, and inspiring collaborative execution.",
    },
    {
      id: "clarity",
      name: "Verbal Clarity & Conciseness",
      category: "delivery",
      description:
        "Speaking with clear intent, avoiding rambling or topic drift, and answering the core question asked directly.",
    },
    {
      id: "pacing",
      name: "Speaking Cadence & Pacing",
      category: "delivery",
      description:
        "Maintaining an even, conversational speed (120-150 WPM) with purposeful pauses rather than rushed speech.",
    },
    {
      id: "filler_words",
      name: "Filler Word Minimization",
      category: "delivery",
      description:
        "Controlling reflexive filler phrases (um, uh, like, you know) when formulating thoughts under interview pressure.",
    },
  ],
});

export const TAXONOMY_VERSION = CANONICAL_TAXONOMY.version;

export const CANONICAL_SKILLS: readonly SkillDefinition[] = CANONICAL_TAXONOMY.skills;

export const CANONICAL_SKILL_IDS: ReadonlySet<string> = new Set(
  CANONICAL_SKILLS.map((skill) => skill.id)
);

const SKILL_MAP = new Map<string, SkillDefinition>(
  CANONICAL_SKILLS.map((skill) => [skill.id, skill])
);

/**
 * Looks up a skill by ID in the canonical taxonomy.
 */
export function getSkillDefinition(skillId: string): SkillDefinition | undefined {
  return SKILL_MAP.get(skillId);
}

/**
 * Checks if a skill is in the delivery category (clarity, pacing, filler words).
 * Delivery skills are evaluated exclusively in voice sessions.
 */
export function isDeliverySkill(skillId: string): boolean {
  return SKILL_MAP.get(skillId)?.category === "delivery";
}

/**
 * Checks if a skill is in the behavioral category.
 */
export function isBehavioralSkill(skillId: string): boolean {
  return SKILL_MAP.get(skillId)?.category === "behavioral";
}

/**
 * Checks if a skill is in the technical category.
 */
export function isTechnicalSkill(skillId: string): boolean {
  return SKILL_MAP.get(skillId)?.category === "technical";
}

/**
 * Returns all skills belonging to a specific category.
 */
export function getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return CANONICAL_SKILLS.filter((s) => s.category === category);
}
