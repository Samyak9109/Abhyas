// FR-003: Deterministic keyword fallback extractor.
// Used when offline, when no AI provider is configured, or if provider calls fail.
// Extracts matching taxonomy skills, experience bullet points, quantified claims, and JD gaps.

export interface FallbackExtractResult {
  skills: string[];
  experiences: {
    role: string;
    company?: string;
    highlights: string[];
  }[];
  gaps: string[];
  quantifiedClaims: string[];
}

const SKILL_KEYWORD_MAP: Record<string, string[]> = {
  frontend: [
    "react",
    "vue",
    "angular",
    "typescript",
    "javascript",
    "html",
    "css",
    "tailwind",
    "nextjs",
    "redux",
    "webpack",
    "vite",
    "accessibility",
    "wcag",
  ],
  backend_apis: [
    "rest",
    "graphql",
    "grpc",
    "api",
    "microservices",
    "fastapi",
    "express",
    "spring",
    "django",
    "gin",
  ],
  databases: [
    "sql",
    "postgresql",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "sqlite",
    "dynamodb",
    "indexeddb",
    "database",
    "prisma",
  ],
  cloud_devops: [
    "docker",
    "kubernetes",
    "aws",
    "gcp",
    "azure",
    "ci/cd",
    "github actions",
    "terraform",
    "linux",
    "ansible",
  ],
  system_design: [
    "system design",
    "distributed systems",
    "kafka",
    "rabbitmq",
    "scalability",
    "caching",
    "load balancer",
    "microservices architecture",
  ],
  dsa: ["algorithms", "data structures", "trees", "graphs", "dynamic programming", "leetcode"],
  ml_ai: [
    "machine learning",
    "deep learning",
    "pytorch",
    "tensorflow",
    "llm",
    "nlp",
    "computer vision",
    "huggingface",
    "openai",
    "gemini",
  ],
  language_specific: [
    "python",
    "go",
    "golang",
    "rust",
    "java",
    "c++",
    "c#",
    "ruby",
    "php",
    "swift",
    "kotlin",
  ],
  leadership: ["mentored", "mentoring", "lead", "leadership", "architected", "tech lead"],
  ownership: ["spearheaded", "owned", "initiative", "launched", "designed from scratch"],
};

const QUANTIFIED_PATTERNS = [
  /\b\d+%(?!\w)/, // percentages: 40%
  /(?:\$|€|£|₹)\s*\d+[\d,.]*[kmb]?(?!\w)/i, // money: $100k
  /\b\d+x(?!\w)/i, // multipliers: 5x
  /\b(?:reduced|increased|improved|scaled|saved|cut)\b[^.\n]*\b\d+/i, // metrics
  /\b\d+[\d,.]*\s*(?:ms|seconds|minutes|hours|days|requests|users|qps|rps|k|m|b)\b/i, // technical metrics
];

/**
 * Extracts skills, experiences, and gaps deterministically using text heuristics.
 */
export function extractFallbackProfile(
  resumeText: string,
  jdText: string = "",
  targetRole: string = ""
): FallbackExtractResult {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jdText.toLowerCase();

  // 1. Identify matched skills
  const matchedSkills = new Set<string>();
  const identifiedSkillNames = new Set<string>();

  for (const [skillId, keywords] of Object.entries(SKILL_KEYWORD_MAP)) {
    for (const kw of keywords) {
      // Word boundary match
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
      if (regex.test(resumeLower)) {
        matchedSkills.add(skillId);
        identifiedSkillNames.add(kw);
      }
    }
  }

  // 2. Identify gaps (keywords found in JD but not in Resume)
  const gaps: string[] = [];
  if (jdText.trim()) {
    for (const keywords of Object.values(SKILL_KEYWORD_MAP)) {
      for (const kw of keywords) {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
        if (regex.test(jdLower) && !regex.test(resumeLower)) {
          if (!gaps.includes(kw)) {
            gaps.push(kw);
          }
        }
      }
    }
  }

  // 3. Identify quantified claims
  const lines = resumeText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 15);
  const quantifiedClaims: string[] = [];

  for (const line of lines) {
    if (QUANTIFIED_PATTERNS.some((p) => p.test(line))) {
      // Clean bullet characters
      const cleaned = line.replace(/^[•\-*–\d.)]\s*/, "");
      if (cleaned.length > 20 && !quantifiedClaims.includes(cleaned)) {
        quantifiedClaims.push(cleaned);
      }
    }
    if (quantifiedClaims.length >= 8) break;
  }

  // 4. Identify experiences
  const experiences: { role: string; company?: string; highlights: string[] }[] = [];
  const currentRole = targetRole || "Software Engineer";
  const experienceHighlights: string[] = [];

  for (const line of lines) {
    if (line.startsWith("-") || line.startsWith("*") || line.startsWith("•")) {
      const cleaned = line.replace(/^[•\-*–]\s*/, "");
      if (cleaned.length > 15) {
        experienceHighlights.push(cleaned);
      }
    }
    if (experienceHighlights.length >= 6) break;
  }

  experiences.push({
    role: currentRole,
    highlights: experienceHighlights.slice(0, 5),
  });

  return {
    skills: Array.from(matchedSkills),
    experiences,
    gaps: gaps.slice(0, 10),
    quantifiedClaims: quantifiedClaims.slice(0, 6),
  };
}
