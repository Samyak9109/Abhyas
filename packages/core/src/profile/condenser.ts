// FR-003, AI-014: Token budget compressor for structured profiles.
// Produces a condensed, high-signal profile summary bounded within 1,200 tokens (approx 4,800 chars),
// suitable for injection into each interviewer turn without exhausting the context budget.

export interface ProfileToCondense {
  skills: string[];
  experiences: {
    role: string;
    company?: string | undefined;
    highlights: string[];
  }[];
  gaps?: string[] | undefined;
  quantifiedClaims?: string[] | undefined;
}

export interface CondenseOptions {
  targetRole?: string;
  level?: string;
  /** Maximum character limit (defaults to 4000 chars, well under the 1,200 token budget) */
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 4000;

/**
 * Compresses structured profile facts into a dense markdown-formatted summary.
 * Guaranteed to fit within the designated token budget.
 */
export function condenseProfile(profile: ProfileToCondense, options: CondenseOptions = {}): string {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const sections: string[] = [];

  // 1. Role and Level header
  const headerParts: string[] = [];
  if (options.targetRole) {
    headerParts.push(`Target Role: ${options.targetRole}`);
  }
  if (options.level) {
    headerParts.push(`Level: ${options.level}`);
  }
  if (headerParts.length > 0) {
    sections.push(headerParts.join(" | "));
  }

  // 2. Verified Skills (up to 25 items)
  if (profile.skills && profile.skills.length > 0) {
    const skillList = profile.skills.slice(0, 25).join(", ");
    sections.push(`Skills: ${skillList}`);
  }

  // 3. Experience Highlights (up to 4 positions, top 3 bullets each)
  if (profile.experiences && profile.experiences.length > 0) {
    const expLines: string[] = ["Experience:"];
    for (const exp of profile.experiences.slice(0, 4)) {
      const title = exp.company ? `${exp.role} at ${exp.company}` : exp.role;
      expLines.push(`- ${title}`);
      for (const hl of exp.highlights.slice(0, 3)) {
        expLines.push(`  * ${hl}`);
      }
    }
    sections.push(expLines.join("\n"));
  }

  // 4. Quantified Claims
  if (profile.quantifiedClaims && profile.quantifiedClaims.length > 0) {
    const claims = profile.quantifiedClaims.slice(0, 5).map((c) => `- ${c}`);
    sections.push(`Quantified Achievements:\n${claims.join("\n")}`);
  }

  // 5. Gaps against target Job Description
  if (profile.gaps && profile.gaps.length > 0) {
    const gapList = profile.gaps.slice(0, 5).map((g) => `- ${g}`);
    sections.push(`Identified Gaps vs Job Description:\n${gapList.join("\n")}`);
  }

  let result = sections.join("\n\n");

  // Hard cap to ensure context budget is never violated
  if (result.length > maxChars) {
    result = result.substring(0, maxChars - 3) + "...";
  }

  return result;
}
