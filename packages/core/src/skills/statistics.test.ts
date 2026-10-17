// FR-014, architecture.md 14: Unit tests for skill statistics, recency weighting, confidence, trend, and recompute.
import { describe, it, expect } from "vitest";
import {
  calculateConfidence,
  calculateRecencyWeightedScore,
  calculateTrend,
  selectWeakestSkill,
  selectStrongestSkill,
  recomputeSkillStats,
  getScoreBand,
  getScoreBandLabel,
  isSkillStale,
  LEVEL_BENCHMARKS,
  getBenchmarkForLevel,
  selectWeakestSkills,
  selectStrongestSkills,
  computeSkillHistory,
} from "./statistics.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";
import type { Evaluation } from "../schemas/evaluation.schema.js";

const mockEvaluation = (score: number, skillScores?: Record<string, number>): Evaluation => {
  const s = Math.min(5, Math.max(1, Math.round(score))) as 1 | 2 | 3 | 4 | 5;
  return {
    criteria: {
      relevance: { score: s, reason: "Relevance check", evidence: "Evidence text" },
      structure: { score: s, reason: "Structure check", evidence: "Evidence text" },
      depth: { score: s, reason: "Depth check", evidence: "Evidence text" },
      clarity: { score: s, reason: "Clarity check", evidence: "Evidence text" },
      levelFit: { score: s, reason: "Level fit check", evidence: "Evidence text" },
    },
    skillScores: skillScores ?? {},
    topFix: "Address edge cases directly.",
    unsupportedClaims: [],
  };
};

describe("M2.1: Skill Statistics Engine (FR-014, architecture.md 14)", () => {
  describe("Confidence Thresholds (architecture.md 14)", () => {
    it("assigns 'low' confidence when n < 3", () => {
      expect(calculateConfidence(0)).toBe("low");
      expect(calculateConfidence(1)).toBe("low");
      expect(calculateConfidence(2)).toBe("low");
    });

    it("assigns 'medium' confidence when 3 <= n < 8", () => {
      expect(calculateConfidence(3)).toBe("medium");
      expect(calculateConfidence(5)).toBe("medium");
      expect(calculateConfidence(7)).toBe("medium");
    });

    it("assigns 'high' confidence when n >= 8", () => {
      expect(calculateConfidence(8)).toBe("high");
      expect(calculateConfidence(15)).toBe("high");
      expect(calculateConfidence(100)).toBe("high");
    });
  });

  describe("Recency-Weighted Score (architecture.md 14: 0.5 ^ (age / 8))", () => {
    it("returns 0 for empty score list", () => {
      expect(calculateRecencyWeightedScore([])).toBe(0);
    });

    it("returns exact score for a single answer", () => {
      expect(calculateRecencyWeightedScore([85])).toBe(85);
    });

    it("returns identical score when all answers are equal", () => {
      expect(calculateRecencyWeightedScore([70, 70, 70, 70])).toBe(70);
    });

    it("weights recent scores more heavily than older scores (rewards improvement)", () => {
      // Scenario A: Improved from 40 to 90
      // Chronological order: [40, 90] (40 is older, 90 is latest)
      const improvingScore = calculateRecencyWeightedScore([40, 90]);

      // Scenario B: Declined from 90 to 40
      // Chronological order: [90, 40] (90 is older, 40 is latest)
      const decliningScore = calculateRecencyWeightedScore([90, 40]);

      // Simple unweighted average for both would be (40+90)/2 = 65.
      // Recency weighting gives age=0 weight 1.0, age=1 weight 0.5^(1/8) ~= 0.917
      expect(improvingScore).toBeGreaterThan(65);
      expect(decliningScore).toBeLessThan(65);
      expect(improvingScore).toBe(66.1);
      expect(decliningScore).toBe(63.9);
    });

    it("verifies half-life H = 8 halves the weight of an answer from 8 turns ago", () => {
      // Answer at age 8 has weight 0.5^1 = 0.5
      // Answer at age 0 has weight 0.5^0 = 1.0
      const scores = [0, 100, 100, 100, 100, 100, 100, 100, 100]; // 9 items: index 0 is age 8
      const weighted = calculateRecencyWeightedScore(scores);

      // Total weight: 1.0 + 0.5^(1/8) + ... + 0.5^(8/8)
      // Since score at age 8 is 0 and all other 8 are 100, result is (sum(w1..w8)*100) / sum(w0..w8)
      expect(weighted).toBeGreaterThan(90);
      expect(weighted).toBeLessThan(95);
    });
  });

  describe("Trend Calculation (architecture.md 14: mean of last 5 minus 5 before, n >= 10)", () => {
    it("returns undefined when n < 10", () => {
      expect(calculateTrend([])).toBeUndefined();
      expect(calculateTrend([80, 85, 90])).toBeUndefined();
      expect(calculateTrend([70, 70, 70, 70, 70, 80, 80, 80, 80])).toBeUndefined(); // 9 items
    });

    it("calculates trend delta accurately when n = 10", () => {
      // 5 older answers at 60, followed by 5 recent answers at 90
      const scores = [60, 60, 60, 60, 60, 90, 90, 90, 90, 90];
      const trend = calculateTrend(scores);
      expect(trend).toBe(30.0);
    });

    it("calculates negative trend when performance declines", () => {
      // 5 older answers at 80, followed by 5 recent answers at 65
      const scores = [80, 80, 80, 80, 80, 65, 65, 65, 65, 65];
      const trend = calculateTrend(scores);
      expect(trend).toBe(-15.0);
    });

    it("calculates trend using only the most recent 10 answers when n > 10", () => {
      // 2 very old answers (10, 10) should not affect the trend
      // 5 answers at 50, followed by 5 answers at 70
      const scores = [10, 10, 50, 50, 50, 50, 50, 70, 70, 70, 70, 70];
      const trend = calculateTrend(scores);
      expect(trend).toBe(20.0);
    });
  });

  describe("Weakest & Strongest Skill Selection (architecture.md 14, FR-014)", () => {
    const mockStats = [
      {
        skillId: "dsa",
        score: 45,
        n: 2, // Low confidence (< 3)
        confidence: "low" as const,
        lastPracticedAt: "2026-10-15T10:00:00.000Z",
        taxonomyVersion: 1,
      },
      {
        skillId: "system_design",
        score: 60,
        n: 4, // Medium confidence (>= 3)
        confidence: "medium" as const,
        lastPracticedAt: "2026-10-15T11:00:00.000Z",
        taxonomyVersion: 1,
      },
      {
        skillId: "frontend",
        score: 85,
        n: 9, // High confidence (>= 8)
        confidence: "high" as const,
        lastPracticedAt: "2026-10-15T12:00:00.000Z",
        taxonomyVersion: 1,
      },
    ];

    it("excludes low-confidence skills when selecting weakest if medium/high confidence skills exist", () => {
      // Even though 'dsa' has score 45, it is low confidence (n=2).
      // 'system_design' has score 60 with medium confidence (n=4).
      // FR-014: 'weakest' excludes low-confidence skills unless nothing else exists.
      const weakest = selectWeakestSkill(mockStats);
      expect(weakest).toBe("system_design");
    });

    it("falls back to least-practiced skill when only low-confidence skills exist", () => {
      const allLowConfidence = [
        {
          skillId: "dsa",
          score: 80,
          n: 2,
          confidence: "low" as const,
          lastPracticedAt: "2026-10-15T10:00:00.000Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "system_design",
          score: 50,
          n: 1, // least practiced
          confidence: "low" as const,
          lastPracticedAt: "2026-10-15T11:00:00.000Z",
          taxonomyVersion: 1,
        },
      ];
      const weakest = selectWeakestSkill(allLowConfidence);
      expect(weakest).toBe("system_design");
    });

    it("prefers unpracticed known skill (n=0) when all practicing skills are low confidence", () => {
      const allLowConfidence = [
        {
          skillId: "dsa",
          score: 80,
          n: 2,
          confidence: "low" as const,
          lastPracticedAt: "2026-10-15T10:00:00.000Z",
          taxonomyVersion: 1,
        },
      ];
      const knownSkills = ["dsa", "databases", "system_design"];
      const weakest = selectWeakestSkill(allLowConfidence, knownSkills);
      // 'databases' and 'system_design' have n = 0, 'databases' comes first alphabetically
      expect(weakest).toBe("databases");
    });

    it("selects the strongest skill among medium/high confidence skills", () => {
      const strongest = selectStrongestSkill(mockStats);
      expect(strongest).toBe("frontend");
    });

    it("returns undefined for strongest skill if all skills are low confidence", () => {
      const allLow = [
        {
          skillId: "dsa",
          score: 95,
          n: 1,
          confidence: "low" as const,
          lastPracticedAt: "2026-10-15T10:00:00.000Z",
          taxonomyVersion: 1,
        },
      ];
      expect(selectStrongestSkill(allLow)).toBeUndefined();
    });
  });

  describe("Deterministic Recompute (recomputeSkillStats)", () => {
    const sessionVoice: SessionRow = {
      id: "session-voice-1",
      startedAt: "2026-10-16T10:00:00.000Z",
      endedAt: "2026-10-16T10:30:00.000Z",
      status: "completed",
      modality: "voice",
      level: "mid",
      providerId: "mock",
      modelId: "mock-model",
      plan: { sessionId: "session-voice-1", length: 5 },
      schemaVersion: 1,
    };

    const sessionText: SessionRow = {
      id: "session-text-1",
      startedAt: "2026-10-16T11:00:00.000Z",
      endedAt: "2026-10-16T11:30:00.000Z",
      status: "completed",
      modality: "text",
      level: "mid",
      providerId: "mock",
      modelId: "mock-model",
      plan: { sessionId: "session-text-1", length: 5 },
      schemaVersion: 1,
    };

    const turns: TurnRow[] = [
      {
        id: "turn-v-1",
        sessionId: "session-voice-1",
        index: 0,
        isUnverifiedQuestion: false,
        skillTags: ["dsa", "clarity"], // clarity is delivery
        difficulty: 0.5,
        questionText: "Explain Dijkstra algorithm.",
        answerText: "Dijkstra finds shortest paths in non-negative weighted graphs.",
        evaluation: mockEvaluation(4, { dsa: 75, clarity: 80 }), // score = 75
        status: "scored",
      },
      {
        id: "turn-v-2",
        sessionId: "session-voice-1",
        index: 1,
        isUnverifiedQuestion: false,
        skillTags: ["dsa", "clarity"],
        difficulty: 0.5,
        questionText: "What is the time complexity with a Fibonacci heap?",
        answerText: "O(E + V log V).",
        evaluation: mockEvaluation(5, { dsa: 95, clarity: 90 }), // score = 95
        status: "scored",
      },
      {
        id: "turn-t-1",
        sessionId: "session-text-1",
        index: 0,
        isUnverifiedQuestion: false,
        skillTags: ["dsa", "clarity"], // in text session, clarity should be skipped!
        difficulty: 0.5,
        questionText: "Implement binary search.",
        answerText: "Compare mid, divide and conquer.",
        evaluation: mockEvaluation(5, { dsa: 100, clarity: 100 }),
        status: "scored",
      },
      {
        id: "turn-t-unscored",
        sessionId: "session-text-1",
        index: 1,
        isUnverifiedQuestion: false,
        skillTags: ["dsa"],
        difficulty: 0.5,
        questionText: "Skipped question",
        answerText: "",
        status: "unscored", // unscored turn must be ignored
      },
      {
        id: "turn-unknown-tag",
        sessionId: "session-text-1",
        index: 2,
        isUnverifiedQuestion: false,
        skillTags: ["unknown_hallucinated_skill", "dsa"],
        difficulty: 0.5,
        questionText: "Question with unknown tag",
        answerText: "Answer text",
        evaluation: mockEvaluation(3, { dsa: 60 }),
        status: "scored",
      },
    ];

    it("recomputes skill statistics deterministically from stored turns", () => {
      const stats = recomputeSkillStats(turns, [sessionVoice, sessionText], {
        knownSkillIds: ["dsa", "clarity"],
      });

      // 'dsa' has 4 scored turns (turn-v-1: 75, turn-v-2: 95, turn-t-1: 100, turn-unknown-tag: 60)
      const dsaStat = stats.find((s) => s.skillId === "dsa");
      expect(dsaStat).toBeDefined();
      expect(dsaStat!.n).toBe(4);
      expect(dsaStat!.confidence).toBe("medium");
      expect(dsaStat!.lastPracticedAt).toBe("2026-10-16T11:30:00.000Z");

      // Running recompute again on the same input produces exactly identical results (Acceptance criterion)
      const statsSecondPass = recomputeSkillStats(turns, [sessionVoice, sessionText], {
        knownSkillIds: ["dsa", "clarity"],
      });
      expect(stats).toEqual(statsSecondPass);
    });

    it("excludes delivery skills from text sessions (architecture.md 14)", () => {
      const stats = recomputeSkillStats(turns, [sessionVoice, sessionText], {
        knownSkillIds: ["dsa", "clarity"],
      });

      const clarityStat = stats.find((s) => s.skillId === "clarity");
      expect(clarityStat).toBeDefined();
      // 'clarity' was tagged in turn-v-1, turn-v-2, and turn-t-1.
      // But turn-t-1 was in a text session, so only the 2 voice turns contribute!
      expect(clarityStat!.n).toBe(2);
      expect(clarityStat!.confidence).toBe("low");
      expect(clarityStat!.lastPracticedAt).toBe("2026-10-16T10:30:00.000Z");
    });

    it("safely excludes unknown tags without failing (FR-014)", () => {
      const stats = recomputeSkillStats(turns, [sessionVoice, sessionText], {
        knownSkillIds: ["dsa", "clarity"],
      });

      const unknownStat = stats.find((s) => s.skillId === "unknown_hallucinated_skill");
      expect(unknownStat).toBeUndefined();
    });

    it("ignores unscored turns entirely", () => {
      const stats = recomputeSkillStats(turns, [sessionVoice, sessionText]);
      const dsaStat = stats.find((s) => s.skillId === "dsa");
      // Total turns tagged dsa was 5 (including 1 unscored), so n should be 4
      expect(dsaStat!.n).toBe(4);
    });
  });

  describe("M2.3: Dashboard Visualization & Calibration Helpers (FR-015, design.md 9)", () => {
    describe("Score Bands (design.md 9)", () => {
      it("classifies scores >= 75 as strong", () => {
        expect(getScoreBand(75)).toBe("strong");
        expect(getScoreBand(88.5)).toBe("strong");
        expect(getScoreBand(100)).toBe("strong");
        expect(getScoreBandLabel("strong")).toBe("Strong");
      });

      it("classifies scores 50 to 74 as developing", () => {
        expect(getScoreBand(50)).toBe("developing");
        expect(getScoreBand(62)).toBe("developing");
        expect(getScoreBand(74.9)).toBe("developing");
        expect(getScoreBandLabel("developing")).toBe("Developing");
      });

      it("classifies scores < 50 as needs_work", () => {
        expect(getScoreBand(0)).toBe("needs_work");
        expect(getScoreBand(35)).toBe("needs_work");
        expect(getScoreBand(49.9)).toBe("needs_work");
        expect(getScoreBandLabel("needs_work")).toBe("Needs work");
      });
    });

    describe("Stale Skills (FR-015, design.md 8)", () => {
      it("flags skills not practiced for >= 14 days as stale", () => {
        const now = new Date("2026-10-17T12:00:00Z");
        const freshDate = "2026-10-10T12:00:00Z"; // 7 days ago
        const staleDate = "2026-10-01T12:00:00Z"; // 16 days ago

        expect(isSkillStale(freshDate, now)).toBe(false);
        expect(isSkillStale(staleDate, now)).toBe(true);
      });

      it("handles custom threshold days", () => {
        const now = new Date("2026-10-17T12:00:00Z");
        const fiveDaysAgo = "2026-10-12T12:00:00Z";
        expect(isSkillStale(fiveDaysAgo, now, 7)).toBe(false);
        expect(isSkillStale(fiveDaysAgo, now, 3)).toBe(true);
      });

      it("returns false for invalid date strings", () => {
        expect(isSkillStale("invalid-date")).toBe(false);
      });
    });

    describe("Level Benchmarks (FR-015)", () => {
      it("maps experience levels to canonical score targets", () => {
        expect(LEVEL_BENCHMARKS.intern_fresher).toBe(60);
        expect(LEVEL_BENCHMARKS.junior).toBe(65);
        expect(LEVEL_BENCHMARKS.mid).toBe(70);
        expect(LEVEL_BENCHMARKS.senior).toBe(75);
        expect(LEVEL_BENCHMARKS.staff_plus).toBe(80);
      });

      it("defaults to mid level (70) when level is unspecified", () => {
        expect(getBenchmarkForLevel(null)).toBe(70);
        expect(getBenchmarkForLevel(undefined)).toBe(70);
        expect(getBenchmarkForLevel("senior")).toBe(75);
      });
    });

    describe("Multi-selection: Weakest & Strongest Skills (FR-015)", () => {
      const stats = [
        {
          skillId: "dsa",
          score: 85,
          n: 10,
          confidence: "high" as const,
          lastPracticedAt: "2026-10-15T00:00:00Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "system_design",
          score: 45,
          n: 5,
          confidence: "medium" as const,
          lastPracticedAt: "2026-10-14T00:00:00Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "communication",
          score: 92,
          n: 6,
          confidence: "medium" as const,
          lastPracticedAt: "2026-10-16T00:00:00Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "databases",
          score: 55,
          n: 4,
          confidence: "medium" as const,
          lastPracticedAt: "2026-10-10T00:00:00Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "ml_ai",
          score: 30,
          n: 1,
          confidence: "low" as const,
          lastPracticedAt: "2026-10-01T00:00:00Z",
          taxonomyVersion: 1,
        },
      ];

      it("selects top N weakest prioritizing medium/high confidence first", () => {
        // If there are 2 medium/high skills and 1 low-confidence skill, low confidence fills the 3rd slot
        const testStats = [
          {
            skillId: "system_design",
            score: 45,
            n: 5,
            confidence: "medium" as const,
            lastPracticedAt: "2026-10-14T00:00:00Z",
            taxonomyVersion: 1,
          },
          {
            skillId: "databases",
            score: 55,
            n: 4,
            confidence: "medium" as const,
            lastPracticedAt: "2026-10-10T00:00:00Z",
            taxonomyVersion: 1,
          },
          {
            skillId: "ml_ai",
            score: 30,
            n: 1,
            confidence: "low" as const,
            lastPracticedAt: "2026-10-01T00:00:00Z",
            taxonomyVersion: 1,
          },
        ];

        const weakest = selectWeakestSkills(testStats, 3);
        expect(weakest).toHaveLength(3);
        expect(weakest[0]?.skillId).toBe("system_design"); // 45 (medium)
        expect(weakest[1]?.skillId).toBe("databases"); // 55 (medium)
        expect(weakest[2]?.skillId).toBe("ml_ai"); // 30 (low)
      });

      it("selects top N strongest among medium/high confidence", () => {
        const strongest = selectStrongestSkills(stats, 2);
        expect(strongest).toHaveLength(2);
        expect(strongest[0]?.skillId).toBe("communication"); // 92
        expect(strongest[1]?.skillId).toBe("dsa"); // 85
      });
    });

    describe("Skill History Points (FR-015)", () => {
      it("extracts chronological scores for a given skill", () => {
        const session: SessionRow = {
          id: "s-1",
          startedAt: "2026-10-16T10:00:00.000Z",
          endedAt: "2026-10-16T10:15:00.000Z",
          status: "completed",
          plan: { sessionId: "s-1", targetRole: "Eng", level: "mid", type: "technical" },
          modality: "voice",
          level: "mid",
          providerId: "openai-compatible",
          modelId: "gpt-4o",
          schemaVersion: 1,
        };

        const turns: TurnRow[] = [
          {
            id: "t-1",
            sessionId: "s-1",
            index: 0,
            questionId: "q-1",
            questionText: "DSA question 1",
            answerText: "Answer 1",
            isUnverifiedQuestion: false,
            skillTags: ["dsa"],
            difficulty: 0.5,
            status: "scored",
            evaluation: mockEvaluation(4, { dsa: 75 }),
          },
          {
            id: "t-2",
            sessionId: "s-1",
            index: 1,
            questionId: "q-2",
            questionText: "DSA question 2",
            answerText: "Answer 2",
            isUnverifiedQuestion: false,
            skillTags: ["dsa"],
            difficulty: 0.6,
            status: "scored",
            evaluation: mockEvaluation(5, { dsa: 95 }),
          },
        ];

        const history = computeSkillHistory(turns, [session], "dsa");
        expect(history).toHaveLength(2);
        expect(history[0]?.score).toBe(75);
        expect(history[1]?.score).toBe(95);
      });
    });
  });

  describe("M2.4: Skill Practice Drill Isolation (FR-016)", () => {
    it("updates only targeted skill statistics from a drill session", () => {
      const drillSession: SessionRow = {
        id: "session-drill-1",
        startedAt: "2026-10-17T10:00:00Z",
        endedAt: "2026-10-17T10:15:00Z",
        status: "completed",
        modality: "voice",
        level: "mid",
        providerId: "mock",
        modelId: "mock",
        plan: {
          sessionId: "session-drill-1",
          isDrill: true,
          targetSkillId: "dsa",
          drillFormat: "quick_fire",
          length: 5,
        },
        schemaVersion: 1,
      };

      // Multi-tag turns: question had dsa, communication, and clarity
      const turns: TurnRow[] = [
        {
          id: "turn-d-1",
          sessionId: "session-drill-1",
          index: 0,
          isUnverifiedQuestion: false,
          skillTags: ["dsa", "communication", "clarity"],
          difficulty: 0.5,
          questionText: "Explain tree traversal.",
          answerText: "In-order, pre-order, post-order.",
          evaluation: mockEvaluation(4, { dsa: 80, communication: 85, clarity: 90 }),
          status: "scored",
        },
        {
          id: "turn-d-2",
          sessionId: "session-drill-1",
          index: 1,
          isUnverifiedQuestion: false,
          skillTags: ["dsa", "communication", "clarity"],
          difficulty: 0.5,
          questionText: "What is topological sort?",
          answerText: "Linear ordering of vertices in a DAG.",
          evaluation: mockEvaluation(5, { dsa: 90, communication: 95, clarity: 85 }),
          status: "scored",
        },
      ];

      const stats = recomputeSkillStats(turns, [drillSession]);
      const dsaStat = stats.find((s) => s.skillId === "dsa");
      const commStat = stats.find((s) => s.skillId === "communication");
      const clarityStat = stats.find((s) => s.skillId === "clarity");

      // DSA was the target skill -> updated
      expect(dsaStat).toBeDefined();
      expect(dsaStat?.n).toBe(2);
      expect(dsaStat?.score).toBeGreaterThan(0);

      // Other skills were NOT targeted -> completely isolated
      expect(commStat).toBeUndefined();
      expect(clarityStat).toBeUndefined();

      // computeSkillHistory isolation
      const dsaHistory = computeSkillHistory(turns, [drillSession], "dsa");
      expect(dsaHistory).toHaveLength(2);

      const commHistory = computeSkillHistory(turns, [drillSession], "communication");
      expect(commHistory).toHaveLength(0);
    });
  });
});
