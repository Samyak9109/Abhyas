// FR-012, FR-013, ADR-006, AI-025: Golden evaluation test suite for M1.7.
// Verifies:
// 1. Golden set v0 contains at least 20 labeled transcripts.
// 2. Two evaluation runs at temperature 0 differ by <= 0.5 Mean Absolute Score (MAS).
// 3. No rewrite contains claims absent from the profile (hallucination guardrail).

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_RUBRICS } from "@abhyas/content";
import {
  evaluateAnswer,
  generateGroundedRewrite,
  validateGrounding,
  type ExperienceLevel,
  type StructuredProfile,
} from "@abhyas/core";

interface GoldenTranscript {
  id: string;
  level: ExperienceLevel;
  targetRole: string;
  question: string;
  skillTags: string[];
  answer: string;
  labeledScores: {
    relevance: number;
    structure: number;
    depth: number;
    clarity: number;
    levelFit: number;
  };
  rationale: string;
  candidateProfile: {
    role: string;
    level: string;
    skills: string[];
    companies: string[];
  };
}

describe("Golden Set v0 Evaluation Suite (FR-012, FR-013, AI-025)", () => {
  // Load golden set from docs/evals/golden-set-v0.json
  const goldenSetPath = path.resolve(process.cwd(), "docs/evals/golden-set-v0.json");
  const rawData = fs.readFileSync(goldenSetPath, "utf-8");
  const transcripts: GoldenTranscript[] = JSON.parse(rawData);

  it("contains at least 20 labeled transcripts covering all experience levels", () => {
    expect(transcripts.length).toBeGreaterThanOrEqual(20);

    const levels = new Set(transcripts.map((t) => t.level));
    expect(levels.has("intern_fresher")).toBe(true);
    expect(levels.has("junior")).toBe(true);
    expect(levels.has("mid")).toBe(true);
    expect(levels.has("senior")).toBe(true);
    expect(levels.has("staff_plus")).toBe(true);
  });

  it("produces identical or stable scores across two evaluation runs (MAS <= 0.5)", async () => {
    const scoresRun1: number[] = [];
    const scoresRun2: number[] = [];

    for (const item of transcripts) {
      const rubric = CANONICAL_RUBRICS[item.level];

      // Run 1
      const res1 = await evaluateAnswer({
        question: { text: item.question, skillTags: item.skillTags, difficulty: 3 },
        answerText: item.answer,
        level: item.level,
        targetRole: item.targetRole,
        rubric,
        forceBasic: true, // Deterministic temperature 0 baseline in CI
      });

      // Run 2
      const res2 = await evaluateAnswer({
        question: { text: item.question, skillTags: item.skillTags, difficulty: 3 },
        answerText: item.answer,
        level: item.level,
        targetRole: item.targetRole,
        rubric,
        forceBasic: true,
      });

      expect(res1.status).toBe("scored");
      expect(res2.status).toBe("scored");

      if (res1.status === "scored" && res2.status === "scored") {
        scoresRun1.push(res1.turnScore);
        scoresRun2.push(res2.turnScore);
      }
    }

    expect(scoresRun1.length).toBe(transcripts.length);
    expect(scoresRun2.length).toBe(transcripts.length);

    // Compute Mean Absolute Score (MAS) difference
    let absoluteDiffSum = 0;
    for (let i = 0; i < scoresRun1.length; i++) {
      absoluteDiffSum += Math.abs(scoresRun1[i]! - scoresRun2[i]!);
    }
    const mas = absoluteDiffSum / transcripts.length;

    // Acceptance criterion: two runs differ by 0.5 mean absolute score or less
    expect(mas).toBeLessThanOrEqual(0.5);
  });

  it("guarantees no rewrite contains claims absent from candidate profiles", async () => {
    for (const item of transcripts) {
      const mockProfile: StructuredProfile = {
        id: `profile-${item.id}`,
        inputHash: `hash-${item.id}`,
        condensed: `${item.candidateProfile.role} with skills in ${item.candidateProfile.skills.join(", ")}. Prior experience at ${item.candidateProfile.companies.join(", ")}.`,
        json: item.candidateProfile,
        promptVersion: 1,
      };

      const rewrite = await generateGroundedRewrite({
        questionText: item.question,
        originalAnswer: item.answer,
        level: item.level,
        targetRole: item.targetRole,
        profile: mockProfile,
      });

      expect(rewrite.rewrittenAnswer.length).toBeGreaterThanOrEqual(20);

      // Verify strict grounding
      const validation = validateGrounding(rewrite.rewrittenAnswer, mockProfile, item.question);
      expect(validation.isGrounded).toBe(true);
      expect(validation.unsupportedClaims.length).toBe(0);
      expect(rewrite.unsupportedClaims.length).toBe(0);
    }
  });
});
