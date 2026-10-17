// M2.2 Acceptance Criteria Tests (phases.md 3, FR-017)
// 1. Difficulty distributions differ measurably by level (unit test)
// 2. Fixture shows one answer scoring differently at two levels (fixture test)

import { describe, expect, it } from "vitest";
import { CANONICAL_RUBRICS, SAMPLE_QUESTION_BANK } from "@abhyas/content";
import {
  evaluateAnswer,
  selectQuestions,
  difficultyBankToNorm,
  LEVEL_BANDS,
  type ExperienceLevel,
  type SessionPlan,
} from "@abhyas/core";

describe("M2.2 Acceptance Criteria (FR-017, phases.md Section 3)", () => {
  describe("Acceptance Criterion 1: Difficulty distributions differ measurably by level", () => {
    it("selects questions whose difficulty strictly aligns with level bands across all 5 levels", async () => {
      const levels: ExperienceLevel[] = ["intern_fresher", "junior", "mid", "senior", "staff_plus"];
      const meanDifficulties: number[] = [];

      for (const level of levels) {
        const plan: SessionPlan = {
          sessionId: `sess-${level}`,
          level,
          targetRole: "Software Engineer",
          type: "mixed",
          length: 5,
          style: "standard",
          inputMode: "text",
          createdAt: new Date().toISOString(),
        };

        const result = await selectQuestions({
          plan,
          bank: SAMPLE_QUESTION_BANK,
          profile: null,
        });

        expect(result.questions.length).toBe(5);

        const range = LEVEL_BANDS[level].difficultyRange;
        const normMin = difficultyBankToNorm(range[0]);
        const normMax = difficultyBankToNorm(range[1]);

        let sumDiff = 0;
        for (const q of result.questions) {
          expect(q.difficulty).toBeGreaterThanOrEqual(normMin);
          expect(q.difficulty).toBeLessThanOrEqual(normMax);
          sumDiff += q.difficulty;
        }

        meanDifficulties.push(sumDiff / result.questions.length);
      }

      // Fresher mean difficulty must be strictly less than senior mean difficulty
      expect(meanDifficulties[0]).toBeLessThan(meanDifficulties[3]!); // intern_fresher < senior
      expect(meanDifficulties[1]).toBeLessThan(meanDifficulties[4]!); // junior < staff_plus
      expect(meanDifficulties[0]).toBeLessThan(meanDifficulties[2]!); // intern_fresher < mid
    });
  });

  describe("Acceptance Criterion 2: Fixture shows one answer scoring differently at two levels", () => {
    it("scores the exact same foundational cycle-detection answer significantly higher at intern_fresher than senior", async () => {
      const question = {
        text: "Explain how you would determine whether a linked list contains a cycle, and what the time and space complexity of your approach would be.",
        skillTags: ["dsa", "communication"],
        difficulty: 2,
      };

      // Direct, clear answer suitable for a new grad, but lacking senior distributed systems/architecture depth
      const answer =
        "To check for a cycle in a linked list, I would use Floyd's Tortoise and Hare algorithm. We initialize a slow pointer moving one step at a time, and a fast pointer moving two steps at a time. If there is a cycle, the fast pointer will eventually catch up and meet the slow pointer. The time complexity is O(n) and the space complexity is O(1) auxiliary space.";

      const fresherRubric = CANONICAL_RUBRICS.intern_fresher;
      const seniorRubric = CANONICAL_RUBRICS.senior;

      const fresherResult = await evaluateAnswer({
        question,
        answerText: answer,
        level: "intern_fresher",
        targetRole: "Software Engineer Intern",
        rubric: fresherRubric,
        forceBasic: true,
      });

      const seniorResult = await evaluateAnswer({
        question,
        answerText: answer,
        level: "senior",
        targetRole: "Senior Backend Engineer",
        rubric: seniorRubric,
        forceBasic: true,
      });

      expect(fresherResult.status).toBe("scored");
      expect(seniorResult.status).toBe("scored");

      if (fresherResult.status === "scored" && seniorResult.status === "scored") {
        // Intern evaluation considers this answer strong and well-aligned with entry-level expectations
        expect(fresherResult.evaluation.criteria.levelFit.score).toBeGreaterThanOrEqual(4);
        expect(fresherResult.turnScore).toBeGreaterThanOrEqual(65);

        // Senior evaluation considers this answer insufficient because it lacks architecture, concurrency, or scale trade-offs
        expect(seniorResult.evaluation.criteria.levelFit.score).toBeLessThanOrEqual(2);
        expect(seniorResult.evaluation.criteria.depth.score).toBeLessThanOrEqual(2);
        expect(seniorResult.turnScore).toBeLessThan(fresherResult.turnScore);

        // Noticeable calibration divergence (at least 15 points)
        expect(fresherResult.turnScore - seniorResult.turnScore).toBeGreaterThanOrEqual(15);
      }
    });
  });
});
