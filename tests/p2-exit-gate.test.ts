// Phase 2 Exit Gate Verification (phases.md line 111, FR-014, FR-015, FR-018)
// Acceptance Criteria:
// - After >= 3 sessions the dashboard shows a believable weakest skill with confidence
// - Statistics reproducible
// - Owner copy review

import { describe, expect, it } from "vitest";
import {
  recomputeSkillStats,
  selectWeakestSkills,
  calculateConfidence,
  getScoreBand,
  getScoreBandLabel,
  getDailyDrillRecommendation,
  LEVEL_BANDS,
  type SessionRow,
  type TurnRow,
  type SkillStatRow,
} from "@abhyas/core";

describe("Phase 2 Exit Gate (phases.md Section 3 & 7)", () => {
  // 1. After >= 3 sessions the dashboard shows a believable weakest skill with confidence
  describe("Exit Criterion 1: After >= 3 sessions, dashboard shows believable weakest skill with confidence", () => {
    it("identifies the weakest skill with at least medium confidence after 3 completed sessions", () => {
      // 3 realistic interview sessions
      const sessions: SessionRow[] = [
        {
          id: "session-1",
          createdAt: "2026-10-15T10:00:00.000Z",
          startedAt: "2026-10-15T10:01:00.000Z",
          endedAt: "2026-10-15T10:20:00.000Z",
          modality: "text",
          targetRole: "Full Stack Engineer",
          level: "mid",
          plan: {
            sessionId: "session-1",
            level: "mid",
            targetRole: "Full Stack Engineer",
            type: "technical",
            length: 2,
            style: "standard",
            inputMode: "text",
            createdAt: "2026-10-15T10:00:00.000Z",
          },
          summary: "First technical session focusing on data structures and system design basics.",
        },
        {
          id: "session-2",
          createdAt: "2026-10-16T11:00:00.000Z",
          startedAt: "2026-10-16T11:01:00.000Z",
          endedAt: "2026-10-16T11:22:00.000Z",
          modality: "text",
          targetRole: "Full Stack Engineer",
          level: "mid",
          plan: {
            sessionId: "session-2",
            level: "mid",
            targetRole: "Full Stack Engineer",
            type: "technical",
            length: 2,
            style: "standard",
            inputMode: "text",
            createdAt: "2026-10-16T11:00:00.000Z",
          },
          summary: "Second technical session on distributed storage and caching.",
        },
        {
          id: "session-3",
          createdAt: "2026-10-17T09:00:00.000Z",
          startedAt: "2026-10-17T09:01:00.000Z",
          endedAt: "2026-10-17T09:15:00.000Z",
          modality: "text",
          targetRole: "Full Stack Engineer",
          level: "mid",
          plan: {
            sessionId: "session-3",
            level: "mid",
            targetRole: "Full Stack Engineer",
            type: "technical",
            length: 1,
            style: "standard",
            inputMode: "text",
            createdAt: "2026-10-17T09:00:00.000Z",
          },
          summary: "Third session: deep dive into microservices communication.",
        },
      ];

      // Turns evaluated across algorithms, communication, and system_design
      // Candidate performs well on algorithms (80, 85) and communication (75, 80)
      // but struggles on system_design (45, 50, 48)
      const turns: TurnRow[] = [
        // Session 1: Turn 1 (algorithms + communication)
        {
          id: "turn-1-1",
          sessionId: "session-1",
          index: 0,
          status: "scored",
          questionText: "Implement an LRU Cache with O(1) get and put operations.",
          answerText:
            "I used a doubly linked list combined with a hash map to achieve O(1) lookups and updates.",
          skillTags: ["algorithms", "communication"],
          evaluation: {
            rubricId: "mid",
            overallScore: 82,
            skillScores: { algorithms: 85, communication: 78 },
            strengths: ["Clean hashmap + doubly linked list explanation"],
            improvements: ["Mention thread safety considerations"],
          },
        },
        // Session 1: Turn 2 (system_design)
        {
          id: "turn-1-2",
          sessionId: "session-1",
          index: 1,
          status: "scored",
          questionText: "How would you design a distributed rate limiter?",
          answerText: "Maybe use Redis with tokens.",
          skillTags: ["system_design"],
          evaluation: {
            rubricId: "mid",
            overallScore: 45,
            skillScores: { system_design: 45 },
            strengths: ["Recognized Redis token bucket concept"],
            improvements: [
              "Did not explain race conditions, sliding windows, or multi-region sync",
            ],
          },
        },
        // Session 2: Turn 1 (algorithms)
        {
          id: "turn-2-1",
          sessionId: "session-2",
          index: 0,
          status: "scored",
          questionText: "Find the median of two sorted arrays in logarithmic time.",
          answerText: "We can perform a binary search on the partition of the smaller array.",
          skillTags: ["algorithms"],
          evaluation: {
            rubricId: "mid",
            overallScore: 88,
            skillScores: { algorithms: 88 },
            strengths: ["Optimal binary search partition approach"],
            improvements: ["Could write cleaner edge condition checks"],
          },
        },
        // Session 2: Turn 2 (system_design + communication)
        {
          id: "turn-2-2",
          sessionId: "session-2",
          index: 1,
          status: "scored",
          questionText:
            "Design a scalable notification service sending millions of push notifications.",
          answerText: "A queue that workers pull from and call Apple/Google APIs.",
          skillTags: ["system_design", "communication"],
          evaluation: {
            rubricId: "mid",
            overallScore: 55,
            skillScores: { system_design: 50, communication: 75 },
            strengths: ["Good communication flow"],
            improvements: ["Missing retry backoff, dead letter queues, and priority tiers"],
          },
        },
        // Session 3: Turn 1 (system_design)
        {
          id: "turn-3-1",
          sessionId: "session-3",
          index: 0,
          status: "scored",
          questionText: "How do you handle idempotency in payment webhook processing?",
          answerText: "Check if the database has the ID before inserting.",
          skillTags: ["system_design"],
          evaluation: {
            rubricId: "mid",
            overallScore: 48,
            skillScores: { system_design: 48 },
            strengths: ["Basic idempotency key understanding"],
            improvements: [
              "Needs distributed lock or database unique constraint with atomic transactions",
            ],
          },
        },
      ];

      // Recompute stats
      const stats: SkillStatRow[] = recomputeSkillStats(turns, sessions);

      // Check system_design stats
      const systemDesignStat = stats.find((s) => s.skillId === "system_design");
      expect(systemDesignStat).toBeDefined();
      expect(systemDesignStat?.n).toBe(3); // Evaluated in 3 turns across 3 sessions
      expect(systemDesignStat?.confidence).toBe("medium"); // n >= 3 yields medium confidence
      expect(calculateConfidence(systemDesignStat!.n)).toBe("medium");

      // Score should reflect the low 40s-50s performance
      expect(systemDesignStat!.score).toBeGreaterThan(40);
      expect(systemDesignStat!.score).toBeLessThan(55);
      expect(getScoreBand(systemDesignStat!.score)).toBe("needs_work");

      // Check algorithms stats (high performing)
      const algorithmsStat = stats.find((s) => s.skillId === "algorithms");
      expect(algorithmsStat).toBeDefined();
      expect(algorithmsStat?.score).toBeGreaterThan(80);
      expect(getScoreBand(algorithmsStat!.score)).toBe("strong");

      // Weakest skill selection: system_design must be rank 1 weakest skill
      const weakest = selectWeakestSkills(stats, 1);
      expect(weakest.length).toBe(1);
      expect(weakest[0]?.skillId).toBe("system_design");
      expect(weakest[0]?.confidence).toBe("medium");

      // Daily drill recommendation must target this believable weakest skill
      const drillRec = getDailyDrillRecommendation(sessions, stats);
      expect(drillRec.skillId).toBe("system_design");
      expect(drillRec.reason).toBe("weakest_calibrated");
    });
  });

  // 2. Statistics reproducible
  describe("Exit Criterion 2: Statistics reproducible", () => {
    it("produces identical statistics regardless of input order and across multiple execution passes", () => {
      const sessionA: SessionRow = {
        id: "s-1",
        createdAt: "2026-10-10T10:00:00.000Z",
        startedAt: "2026-10-10T10:00:00.000Z",
        endedAt: "2026-10-10T10:15:00.000Z",
        modality: "text",
        targetRole: "Engineer",
        level: "mid",
      };
      const sessionB: SessionRow = {
        id: "s-2",
        createdAt: "2026-10-11T10:00:00.000Z",
        startedAt: "2026-10-11T10:00:00.000Z",
        endedAt: "2026-10-11T10:15:00.000Z",
        modality: "text",
        targetRole: "Engineer",
        level: "mid",
      };

      const turn1: TurnRow = {
        id: "t-1",
        sessionId: "s-1",
        index: 0,
        status: "scored",
        questionText: "Q1",
        answerText: "A1",
        skillTags: ["dsa", "testing_debugging"],
        evaluation: {
          rubricId: "mid",
          overallScore: 70,
          skillScores: { dsa: 72, testing_debugging: 68 },
          strengths: ["Clear"],
          improvements: ["More edge cases"],
        },
      };
      const turn2: TurnRow = {
        id: "t-2",
        sessionId: "s-1",
        index: 1,
        status: "scored",
        questionText: "Q2",
        answerText: "A2",
        skillTags: ["dsa"],
        evaluation: {
          rubricId: "mid",
          overallScore: 80,
          skillScores: { dsa: 80 },
          strengths: ["Solid approach"],
          improvements: [],
        },
      };
      const turn3: TurnRow = {
        id: "t-3",
        sessionId: "s-2",
        index: 0,
        status: "scored",
        questionText: "Q3",
        answerText: "A3",
        skillTags: ["testing_debugging"],
        evaluation: {
          rubricId: "mid",
          overallScore: 60,
          skillScores: { testing_debugging: 60 },
          strengths: ["Good test plan"],
          improvements: ["Mock network timeouts"],
        },
      };

      // Pass 1: normal order
      const stats1 = recomputeSkillStats([turn1, turn2, turn3], [sessionA, sessionB]);

      // Pass 2: reversed order
      const stats2 = recomputeSkillStats([turn3, turn2, turn1], [sessionB, sessionA]);

      // Pass 3: arbitrary shuffle
      const stats3 = recomputeSkillStats([turn2, turn3, turn1], [sessionA, sessionB]);

      // All 3 passes must produce byte-for-byte identical JSON
      expect(JSON.stringify(stats1)).toEqual(JSON.stringify(stats2));
      expect(JSON.stringify(stats1)).toEqual(JSON.stringify(stats3));
    });
  });

  // 3. Owner copy review
  describe("Exit Criterion 3: Owner copy review & tone guidelines", () => {
    it("adheres to non-punitive, supportive copy across score bands and levels", () => {
      // Band labels must never use punitive or demeaning terms
      const bandLabels = [
        getScoreBandLabel("strong"),
        getScoreBandLabel("developing"),
        getScoreBandLabel("needs_work"),
      ];

      expect(bandLabels).toContain("Strong");
      expect(bandLabels).toContain("Developing");
      expect(bandLabels).toContain("Needs work");

      // Verify no derogatory labels
      const disallowedWords = ["fail", "bad", "poor", "terrible", "unqualified", "reject"];
      for (const label of bandLabels) {
        for (const disallowed of disallowedWords) {
          expect(label.toLowerCase()).not.toContain(disallowed);
        }
      }

      // Verify level band configurations exist and are constructive
      const levels = ["intern_fresher", "junior", "mid", "senior", "staff_plus"] as const;
      for (const level of levels) {
        const config = LEVEL_BANDS[level];
        expect(config.label).toBeDefined();
        expect(config.description).toBeDefined();
        expect(config.axes.depth).toBeDefined();
        expect(config.axes.followUpPressure).toBeDefined();
        expect(config.axes.behavioralExpectations).toBeDefined();
      }
    });
  });
});
