import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "../storage/memory-storage.js";
import type { TurnRow } from "../schemas/storage-rows.schema.js";
import { calculateTurnScore } from "../evaluation/rubric-evaluator.js";
import {
  calculateNextInterval,
  createReviewItem,
  enrichReviewItems,
  getDailyReviewSet,
  isWeakTurn,
  processReviewOutcome,
  syncSessionWeakTurnsToQueue,
} from "./engine.js";
import type { ReviewQueueRow } from "./types.js";

function makeTurn(overrides: Partial<TurnRow> = {}): TurnRow {
  return {
    id: "turn-1",
    sessionId: "sess-1",
    index: 0,
    questionId: "q-1",
    isUnverifiedQuestion: false,
    skillTags: ["system_design"],
    difficulty: 0.5,
    questionText: "How would you design a distributed cache?",
    answerText: "I would use Redis with consistent hashing.",
    status: "scored",
    evaluation: {
      criteria: {
        relevance: { score: 4, reason: "Good", evidence: "Redis" },
        structure: { score: 4, reason: "Good", evidence: "Redis" },
        depth: { score: 4, reason: "Good", evidence: "Redis" },
        clarity: { score: 4, reason: "Good", evidence: "Redis" },
        levelFit: { score: 4, reason: "Good", evidence: "Redis" },
      },
      skillScores: { system_design: 75 },
      topFix: "Add detail on eviction policies",
      unsupportedClaims: [],
    },
    ...overrides,
  };
}

describe("FR-028: Spaced Repetition Engine", () => {
  describe("calculateTurnScore & isWeakTurn", () => {
    it("computes 0-100 turn score from criteria", () => {
      // 4 out of 5 mean -> ((4 - 1) / 4) * 100 = 75
      const turn = makeTurn();
      expect(calculateTurnScore(turn.evaluation!)).toBe(75);
      expect(isWeakTurn(turn)).toBe(false);
    });

    it("identifies low-scoring turns as weak", () => {
      // 2 out of 5 mean -> ((2 - 1) / 4) * 100 = 25
      const weakTurn = makeTurn({
        evaluation: {
          criteria: {
            relevance: { score: 2, reason: "Off-topic", evidence: "None" },
            structure: { score: 2, reason: "Poor", evidence: "None" },
            depth: { score: 2, reason: "Shallow", evidence: "None" },
            clarity: { score: 2, reason: "Unclear", evidence: "None" },
            levelFit: { score: 2, reason: "Too junior", evidence: "None" },
          },
          skillScores: {},
          topFix: "Structure with STAR",
          unsupportedClaims: [],
        },
      });

      expect(calculateTurnScore(weakTurn.evaluation!)).toBe(25);
      expect(isWeakTurn(weakTurn)).toBe(true);
    });

    it("flags turn as weak if any single criterion is <= 2", () => {
      const turn = makeTurn({
        evaluation: {
          criteria: {
            relevance: { score: 5, reason: "Good", evidence: "..." },
            structure: { score: 5, reason: "Good", evidence: "..." },
            depth: { score: 2, reason: "Too shallow", evidence: "..." }, // <= 2
            clarity: { score: 5, reason: "Good", evidence: "..." },
            levelFit: { score: 4, reason: "Good", evidence: "..." },
          },
          skillScores: {},
          topFix: "Deepen explanation",
          unsupportedClaims: [],
        },
      });

      expect(isWeakTurn(turn)).toBe(true);
    });

    it("does not flag unscored turns", () => {
      const unscored = makeTurn({ status: "unscored", evaluation: undefined });
      expect(isWeakTurn(unscored)).toBe(false);
    });
  });

  describe("calculateNextInterval", () => {
    it("expands interval on good answers", () => {
      expect(calculateNextInterval(1, true)).toBe(3);
      expect(calculateNextInterval(3, true)).toBe(7);
      expect(calculateNextInterval(7, true)).toBe(14);
      expect(calculateNextInterval(14, true)).toBe(30);
      expect(calculateNextInterval(30, true)).toBe(60);
      expect(calculateNextInterval(60, true)).toBe(120);
    });

    it("resets interval to 1 on poor answers", () => {
      expect(calculateNextInterval(1, false)).toBe(1);
      expect(calculateNextInterval(7, false)).toBe(1);
      expect(calculateNextInterval(14, false)).toBe(1);
      expect(calculateNextInterval(60, false)).toBe(1);
    });
  });

  describe("createReviewItem and processReviewOutcome", () => {
    const fixedNow = new Date("2026-10-21T10:00:00.000Z");

    it("creates review item with 1-day initial interval", () => {
      const item = createReviewItem("turn-42", { now: fixedNow });
      expect(item.id).toBe("review-turn-42");
      expect(item.turnId).toBe("turn-42");
      expect(item.intervalDays).toBe(1);
      expect(item.dueAt).toBe("2026-10-22T10:00:00.000Z");
    });

    it("updates interval and due date after practice", () => {
      const item: ReviewQueueRow = {
        id: "review-turn-1",
        turnId: "turn-1",
        intervalDays: 3,
        dueAt: "2026-10-21T10:00:00.000Z",
      };

      // Good answer (80): 3 -> 7 days
      const updatedGood = processReviewOutcome(item, 80, fixedNow);
      expect(updatedGood.intervalDays).toBe(7);
      expect(updatedGood.dueAt).toBe("2026-10-28T10:00:00.000Z");

      // Poor answer (45): resets to 1 day
      const updatedPoor = processReviewOutcome(item, 45, fixedNow);
      expect(updatedPoor.intervalDays).toBe(1);
      expect(updatedPoor.dueAt).toBe("2026-10-22T10:00:00.000Z");
    });
  });

  describe("getDailyReviewSet and daily cap", () => {
    it("filters only items due on or before reference date", () => {
      const refDate = new Date("2026-10-21T12:00:00.000Z");
      const items: ReviewQueueRow[] = [
        {
          id: "r-1",
          turnId: "t-1",
          intervalDays: 1,
          dueAt: "2026-10-19T10:00:00.000Z", // overdue
        },
        {
          id: "r-2",
          turnId: "t-2",
          intervalDays: 3,
          dueAt: "2026-10-21T10:00:00.000Z", // due today
        },
        {
          id: "r-3",
          turnId: "t-3",
          intervalDays: 7,
          dueAt: "2026-10-25T10:00:00.000Z", // future
        },
      ];

      const dailySet = getDailyReviewSet(items, { referenceDate: refDate });
      expect(dailySet.length).toBe(2);
      expect(dailySet[0]!.id).toBe("r-1"); // earliest / most overdue first
      expect(dailySet[1]!.id).toBe("r-2");
    });

    it("enforces daily cap when large queues exist (FR-028 acceptance)", () => {
      const refDate = new Date("2026-10-21T12:00:00.000Z");
      // 20 items due today
      const items: ReviewQueueRow[] = Array.from({ length: 20 }, (_, i) => ({
        id: `r-${i + 1}`,
        turnId: `t-${i + 1}`,
        intervalDays: 1,
        dueAt: new Date(refDate.getTime() - (20 - i) * 3600000).toISOString(),
      }));

      // Default daily cap: 10
      const defaultCapped = getDailyReviewSet(items, { referenceDate: refDate });
      expect(defaultCapped.length).toBe(10);
      expect(defaultCapped[0]!.id).toBe("r-1"); // oldest first

      // Custom daily cap: 5
      const customCapped = getDailyReviewSet(items, { referenceDate: refDate, maxDailyCap: 5 });
      expect(customCapped.length).toBe(5);
    });
  });

  describe("enrichReviewItems", () => {
    it("attaches turns, computes daysOverdue, and tags isDue", () => {
      const now = new Date("2026-10-21T12:00:00.000Z");
      const turn = makeTurn({ id: "turn-100" });
      const turnsMap = new Map([["turn-100", turn]]);

      const items: ReviewQueueRow[] = [
        {
          id: "r-1",
          turnId: "turn-100",
          intervalDays: 1,
          dueAt: "2026-10-19T12:00:00.000Z", // 2 days overdue
        },
      ];

      const enriched = enrichReviewItems(items, turnsMap, now);
      expect(enriched.length).toBe(1);
      expect(enriched[0]!.isDue).toBe(true);
      expect(enriched[0]!.daysOverdue).toBe(2);
      expect(enriched[0]!.turn?.id).toBe("turn-100");
      expect(enriched[0]!.pastScore).toBe(75);
    });
  });

  describe("syncSessionWeakTurnsToQueue", () => {
    it("scans turns and inserts only weak turns into reviewQueue table", async () => {
      const storage = new MemoryStorageAdapter();

      const strongTurn = makeTurn({ id: "turn-strong" });
      const weakTurn1 = makeTurn({
        id: "turn-weak-1",
        evaluation: {
          criteria: {
            relevance: { score: 1, reason: "Off-topic", evidence: "" },
            structure: { score: 1, reason: "Bad", evidence: "" },
            depth: { score: 1, reason: "None", evidence: "" },
            clarity: { score: 1, reason: "Unclear", evidence: "" },
            levelFit: { score: 1, reason: "Poor", evidence: "" },
          },
          skillScores: {},
          topFix: "Use STAR format",
          unsupportedClaims: [],
        },
      });
      const weakTurn2 = makeTurn({
        id: "turn-weak-2",
        evaluation: {
          criteria: {
            relevance: { score: 2, reason: "Weak", evidence: "" },
            structure: { score: 2, reason: "Weak", evidence: "" },
            depth: { score: 2, reason: "Weak", evidence: "" },
            clarity: { score: 2, reason: "Weak", evidence: "" },
            levelFit: { score: 2, reason: "Weak", evidence: "" },
          },
          skillScores: {},
          topFix: "Provide concrete metrics",
          unsupportedClaims: [],
        },
      });

      const count = await syncSessionWeakTurnsToQueue(storage, [strongTurn, weakTurn1, weakTurn2]);
      expect(count).toBe(2);

      const rows = await storage.getAll<ReviewQueueRow>("reviewQueue");
      expect(rows.length).toBe(2);
      expect(rows.some((r) => r.turnId === "turn-weak-1")).toBe(true);
      expect(rows.some((r) => r.turnId === "turn-weak-2")).toBe(true);
      expect(rows.some((r) => r.turnId === "turn-strong")).toBe(false);

      // Re-running does not duplicate existing rows
      const secondRun = await syncSessionWeakTurnsToQueue(storage, [weakTurn1, weakTurn2]);
      expect(secondRun).toBe(0);
      const rowsAfter = await storage.getAll<ReviewQueueRow>("reviewQueue");
      expect(rowsAfter.length).toBe(2);
    });
  });
});
