// FR-003, AI-014: Tests for profile condenser and token budget limits.
import { describe, expect, it } from "vitest";
import { condenseProfile } from "./condenser";

describe("Profile Condenser & Token Budget (FR-003, AI-014)", () => {
  it("formats structured profile fields into markdown summary", () => {
    const profile = {
      skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      experiences: [
        {
          role: "Senior Software Engineer",
          company: "Tech Corp",
          highlights: [
            "Architected real-time streaming dashboard handling 10k events/sec",
            "Reduced bundle size by 35% with dynamic imports",
          ],
        },
      ],
      quantifiedClaims: ["Reduced bundle size by 35%", "10k events/sec"],
      gaps: ["Kubernetes", "GraphQL"],
    };

    const condensed = condenseProfile(profile, {
      targetRole: "Full Stack Engineer",
      level: "senior",
    });

    expect(condensed).toContain("Target Role: Full Stack Engineer | Level: senior");
    expect(condensed).toContain("Skills: React, TypeScript, Node.js, PostgreSQL");
    expect(condensed).toContain("Senior Software Engineer at Tech Corp");
    expect(condensed).toContain("Reduced bundle size by 35%");
    expect(condensed).toContain("Identified Gaps vs Job Description:");
    expect(condensed).toContain("- Kubernetes");
  });

  it("strictly enforces character budget even with massive inputs", () => {
    const hugeSkills = Array.from({ length: 100 }, (_, i) => `SkillNumber${i}`);
    const hugeExperiences = Array.from({ length: 20 }, (_, i) => ({
      role: `Engineering Role ${i}`,
      company: `Corporation ${i}`,
      highlights: Array.from(
        { length: 10 },
        (_, j) =>
          `Extremely verbose accomplishment description number ${j} repeated multiple times to exceed budget`
      ),
    }));

    const condensed = condenseProfile(
      { skills: hugeSkills, experiences: hugeExperiences },
      { maxChars: 500 }
    );

    expect(condensed.length).toBeLessThanOrEqual(500);
    expect(condensed.endsWith("...")).toBe(true);
  });

  it("fits comfortably under the 1,200 token budget (default maxChars 4000)", () => {
    const profile = {
      skills: Array.from({ length: 30 }, (_, i) => `TechSkill-${i}`),
      experiences: Array.from({ length: 5 }, (_, i) => ({
        role: `Role ${i}`,
        company: `Company ${i}`,
        highlights: [
          `Highlight A for role ${i} with detailed context`,
          `Highlight B for role ${i} with technical outcomes`,
          `Highlight C for role ${i} with metrics and impact`,
        ],
      })),
      gaps: ["Cloud Infrastructure", "Distributed Tracing"],
      quantifiedClaims: ["Increased throughput by 50%", "Saved $20k in cloud compute"],
    };

    const condensed = condenseProfile(profile, {
      targetRole: "Staff Engineer",
      level: "staff_plus",
    });

    // 1 token ≈ 4 chars. 1,200 tokens ≈ 4,800 chars.
    // Default maxChars is 4,000, ensuring strictly < 1,200 tokens.
    expect(condensed.length).toBeLessThanOrEqual(4000);
  });
});
