// FR-014, architecture.md 14: Tests for skill statistics recomputation service, worker integration, and storage persistence.
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorageAdapter, type SessionRow, type TurnRow } from "@abhyas/core";
import {
  recomputeSkillStatsAsync,
  recomputeAndStoreSkillStats,
  getSkillStatsSummary,
  type SkillStatsSummary,
} from "./skills-recompute";

describe("M2.1: Skills Recompute Service (FR-014, architecture.md 14)", () => {
  let storage: MemoryStorageAdapter;

  const mockSession: SessionRow = {
    id: "session-1",
    startedAt: "2026-10-16T12:00:00.000Z",
    endedAt: "2026-10-16T12:20:00.000Z",
    status: "completed",
    modality: "voice",
    level: "mid",
    providerId: "mock",
    modelId: "mock-model",
    plan: { sessionId: "session-1", length: 3 },
    schemaVersion: 1,
  };

  const mockTurns: TurnRow[] = [
    {
      id: "turn-1",
      sessionId: "session-1",
      index: 0,
      isUnverifiedQuestion: false,
      skillTags: ["dsa", "communication"],
      difficulty: 0.5,
      questionText: "Explain LRU cache eviction policy.",
      answerText: "Use a hash map and doubly linked list for O(1) operations.",
      evaluation: {
        criteria: {
          relevance: { score: 4, reason: "Good", evidence: "LRU text" },
          structure: { score: 4, reason: "Good", evidence: "LRU text" },
          depth: { score: 4, reason: "Good", evidence: "LRU text" },
          clarity: { score: 4, reason: "Good", evidence: "LRU text" },
          levelFit: { score: 4, reason: "Good", evidence: "LRU text" },
        },
        skillScores: { dsa: 75, communication: 80 },
        topFix: "Discuss eviction edge cases",
        unsupportedClaims: [],
      },
      status: "scored",
    },
    {
      id: "turn-2",
      sessionId: "session-1",
      index: 1,
      isUnverifiedQuestion: false,
      skillTags: ["dsa", "communication"],
      difficulty: 0.6,
      questionText: "How do you handle thread-safety in an LRU cache?",
      answerText: "Read-write locks or concurrent hash maps with segment locking.",
      evaluation: {
        criteria: {
          relevance: { score: 5, reason: "Excellent", evidence: "Locks text" },
          structure: { score: 5, reason: "Excellent", evidence: "Locks text" },
          depth: { score: 5, reason: "Excellent", evidence: "Locks text" },
          clarity: { score: 5, reason: "Excellent", evidence: "Locks text" },
          levelFit: { score: 5, reason: "Excellent", evidence: "Locks text" },
        },
        skillScores: { dsa: 95, communication: 85 },
        topFix: "Add benchmarks",
        unsupportedClaims: [],
      },
      status: "scored",
    },
    {
      id: "turn-3",
      sessionId: "session-1",
      index: 2,
      isUnverifiedQuestion: false,
      skillTags: ["dsa"],
      difficulty: 0.6,
      questionText: "What if memory is constrained?",
      answerText: "Scale down capacity dynamically.",
      evaluation: {
        criteria: {
          relevance: { score: 5, reason: "Great", evidence: "Memory text" },
          structure: { score: 5, reason: "Great", evidence: "Memory text" },
          depth: { score: 4, reason: "Great", evidence: "Memory text" },
          clarity: { score: 4, reason: "Great", evidence: "Memory text" },
          levelFit: { score: 4, reason: "Great", evidence: "Memory text" },
        },
        skillScores: { dsa: 85 },
        topFix: "Specify threshold limits",
        unsupportedClaims: [],
      },
      status: "scored",
    },
  ];

  beforeEach(async () => {
    storage = new MemoryStorageAdapter();
  });

  it("recomputes skill statistics asynchronously", async () => {
    const stats = await recomputeSkillStatsAsync(mockTurns, [mockSession]);

    expect(stats).toHaveLength(2); // 'dsa' and 'communication'

    const dsa = stats.find((s) => s.skillId === "dsa");
    expect(dsa).toBeDefined();
    expect(dsa!.n).toBe(3);
    expect(dsa!.confidence).toBe("medium"); // 3 <= n < 8 is medium
    expect(dsa!.score).toBeGreaterThan(80);

    const comm = stats.find((s) => s.skillId === "communication");
    expect(comm).toBeDefined();
    expect(comm!.n).toBe(2);
    expect(comm!.confidence).toBe("low"); // n < 3 is low
  });

  it("persists recomputed statistics into storage (recomputeAndStoreSkillStats)", async () => {
    // Put session and turns in storage
    await storage.put("sessions", mockSession);
    for (const turn of mockTurns) {
      await storage.put("turns", turn);
    }

    // Call service to recompute and persist
    const savedStats = await recomputeAndStoreSkillStats(storage);
    expect(savedStats).toHaveLength(2);

    // Verify stored rows in Dexie/storage table
    const dbRows = await storage.getAll("skillStats");
    expect(dbRows).toHaveLength(2);
    expect(dbRows).toEqual(savedStats);

    // Verify deterministic re-run replaces cleanly
    const secondPass = await recomputeAndStoreSkillStats(storage);
    const dbRowsSecondPass = await storage.getAll("skillStats");
    expect(dbRowsSecondPass).toEqual(secondPass);
    expect(dbRowsSecondPass).toHaveLength(2);
  });

  it("extracts summary metrics with confidence thresholds (getSkillStatsSummary)", async () => {
    await storage.put("sessions", mockSession);
    for (const turn of mockTurns) {
      await storage.put("turns", turn);
    }
    await recomputeAndStoreSkillStats(storage);

    const summary: SkillStatsSummary = await getSkillStatsSummary(storage);
    expect(summary.stats).toHaveLength(2);

    // 'dsa' has medium confidence (n=3) and score > 80.
    // 'communication' has low confidence (n=2).
    // Medium-confidence skills: only 'dsa'.
    // Strongest skill among medium+ confidence is 'dsa':
    expect(summary.strongestSkillId).toBe("dsa");

    // Weakest skill:
    // With medium confidence skills, 'dsa' is the only one with medium confidence.
    // So 'dsa' is selected as weakest among medium+ confidence.
    expect(summary.weakestSkillId).toBe("dsa");
  });
});
