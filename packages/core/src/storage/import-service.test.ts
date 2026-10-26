// FR-020, FR-019: Tests for import validation, execution, and session deletion.
import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "./memory-storage.js";
import { buildExport } from "./export-format.js";
import { deleteSession, executeImport, validateImport } from "./import-service.js";
import type { ProviderRow, SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";

const TEST_TIMESTAMP = "2026-10-17T12:00:00.000Z";

async function createPopulatedStorage() {
  const storage = new MemoryStorageAdapter();

  // Profile
  await storage.put("profile", {
    id: "prof_1",
    level: "senior",
    targetRole: "Frontend Lead",
    updatedAt: TEST_TIMESTAMP,
  });

  // Session 1
  const session1: SessionRow = {
    id: "sess_1",
    startedAt: "2026-10-17T10:00:00.000Z",
    endedAt: "2026-10-17T10:15:00.000Z",
    status: "completed",
    plan: { interviewType: "technical", length: 2, interviewerStyle: "neutral" },
    modality: "text",
    level: "senior",
    providerId: "gemini",
    modelId: "gemini-1.5-flash",
    schemaVersion: 1,
  };
  await storage.put("sessions", session1);

  // Turn 1 for session 1
  const turn1: TurnRow = {
    id: "turn_1",
    sessionId: "sess_1",
    index: 0,
    isUnverifiedQuestion: false,
    skillTags: ["javascript", "system_design"],
    difficulty: 0.7,
    questionText: "Explain the JavaScript event loop.",
    answerText: "Microtasks run before macrotasks.",
    evaluation: {
      criteria: {
        relevance: { score: 4, reason: "Relevant", evidence: "Event loop" },
        structure: { score: 4, reason: "Good", evidence: "Event loop" },
        depth: { score: 4, reason: "Deep", evidence: "Event loop" },
        clarity: { score: 4, reason: "Clear", evidence: "Event loop" },
        levelFit: { score: 4, reason: "Senior fit", evidence: "Event loop" },
      },
      skillScores: { javascript: 75, system_design: 75 },
      topFix: "Elaborate on Node.js libuv queues",
      unsupportedClaims: [],
    },
    status: "scored",
  };
  await storage.put("turns", turn1);

  // Session 2
  const session2: SessionRow = {
    id: "sess_2",
    startedAt: "2026-10-17T11:00:00.000Z",
    endedAt: "2026-10-17T11:20:00.000Z",
    status: "completed",
    plan: { interviewType: "behavioral", length: 1, interviewerStyle: "friendly" },
    modality: "voice",
    level: "senior",
    providerId: "gemini",
    modelId: "gemini-1.5-flash",
    schemaVersion: 1,
  };
  await storage.put("sessions", session2);

  // Turn 2 for session 2
  const turn2: TurnRow = {
    id: "turn_2",
    sessionId: "sess_2",
    index: 0,
    isUnverifiedQuestion: false,
    skillTags: ["communication"],
    difficulty: 0.6,
    questionText: "Tell me about a time you handled conflict.",
    answerText: "I used active listening and aligned on common goals.",
    evaluation: {
      criteria: {
        relevance: { score: 5, reason: "Direct", evidence: "Active listening" },
        structure: { score: 5, reason: "STAR", evidence: "Active listening" },
        depth: { score: 4, reason: "Good depth", evidence: "Active listening" },
        clarity: { score: 5, reason: "Very clear", evidence: "Active listening" },
        levelFit: { score: 5, reason: "Senior leadership", evidence: "Active listening" },
      },
      skillScores: { communication: 90 },
      topFix: "Mention long-term outcome",
      unsupportedClaims: [],
    },
    delivery: {
      wordsPerMinute: 135,
      fillerWordCount: 1,
      pauseSeconds: 2.5,
      answerLengthWords: 80,
    },
    status: "scored",
  };
  await storage.put("turns", turn2);

  // Review queue item pointing to turn 1
  await storage.put("reviewQueue", {
    id: "rq_1",
    turnId: "turn_1",
    dueAt: "2026-10-18T10:00:00.000Z",
    intervalDays: 1,
  });

  return storage;
}

describe("M2.5: Import validation and execution (FR-020)", () => {
  it("validates valid backup JSON and accurately computes item counts", async () => {
    const storage = await createPopulatedStorage();
    const exportData = await buildExport(storage);
    const jsonStr = JSON.stringify(exportData);

    const report = await validateImport(jsonStr);
    expect(report.valid).toBe(true);
    expect(report.counts.sessions).toBe(2);
    expect(report.counts.turns).toBe(2);
    expect(report.counts.profile).toBe(1);
    expect(report.counts.reviewQueue).toBe(1);
    expect(report.summary.sessionsCount).toBe(2);
    expect(report.summary.hasProfile).toBe(true);
  });

  it("detects duplicate sessions when comparing against current storage", async () => {
    const storage = await createPopulatedStorage();
    const exportData = await buildExport(storage);
    const jsonStr = JSON.stringify(exportData);

    const report = await validateImport(jsonStr, storage);
    expect(report.valid).toBe(true);
    expect(report.conflicts.duplicateSessions).toBe(2);
    expect(report.conflicts.newSessions).toBe(0);

    // If we test with a clean storage, all sessions should be reported as new
    const freshStorage = new MemoryStorageAdapter();
    const freshReport = await validateImport(jsonStr, freshStorage);
    expect(freshReport.conflicts.duplicateSessions).toBe(0);
    expect(freshReport.conflicts.newSessions).toBe(2);
  });

  it("refuses malformed JSON with an explanatory error", async () => {
    const report = await validateImport("{ invalid json content");
    expect(report.valid).toBe(false);
    expect(report.error).toBe("invalid_json");
    expect(report.errorMessage).toContain("not valid JSON");
  });

  it("refuses newer schema versions without modifying data", async () => {
    const futurePayload = {
      app: "abhyas",
      schemaVersion: 999,
      exportedAt: TEST_TIMESTAMP,
      tables: {},
    };
    const report = await validateImport(JSON.stringify(futurePayload));
    expect(report.valid).toBe(false);
    expect(report.error).toBe("unsupported_version");
    expect(report.errorMessage).toContain("newer version");
  });

  it("refuses files not adhering to the Abhyas backup schema", async () => {
    const foreignPayload = {
      app: "random_other_app",
      schemaVersion: 1,
      exportedAt: TEST_TIMESTAMP,
      tables: {},
    };
    const report = await validateImport(JSON.stringify(foreignPayload));
    expect(report.valid).toBe(false);
    expect(report.error).toBe("invalid_schema");
  });

  it("export then import round trip faithfully reproduces stored data (FR-020 acceptance criteria)", async () => {
    const sourceStorage = await createPopulatedStorage();
    const exportedFile = await buildExport(sourceStorage);

    const targetStorage = new MemoryStorageAdapter();
    const importResult = await executeImport(targetStorage, exportedFile);

    expect(importResult.success).toBe(true);
    expect(importResult.importedSessions).toBe(2);
    expect(importResult.importedTurns).toBe(2);

    // Verify target storage has the exact same records
    const sessions = await targetStorage.getAll<SessionRow>("sessions");
    expect(sessions.length).toBe(2);
    expect(sessions.find((s) => s.id === "sess_1")).toBeDefined();
    expect(sessions.find((s) => s.id === "sess_2")).toBeDefined();

    const turns = await targetStorage.getAll<TurnRow>("turns");
    expect(turns.length).toBe(2);

    const profile = await targetStorage.getAll("profile");
    expect(profile.length).toBe(1);

    // Verify skill stats were recomputed on import
    const skillStats = await targetStorage.getAll("skillStats");
    expect(skillStats.length).toBeGreaterThan(0);
  });

  it("preserves configured API key and encryptedKey when importing merge backup without keys (Finding 4)", async () => {
    const storage = new MemoryStorageAdapter();
    // Existing provider with configured encryptedKey
    await storage.put("providers", {
      id: "gemini",
      name: "Google Gemini",
      kind: "cloud",
      status: "configured",
      roles: { interviewer: "gemini-1.5-flash", evaluator: "gemini-1.5-flash" },
      encryptedKey: "existing-encrypted-key-secret",
      key: "existing-plain-key",
    });

    const exportSource = new MemoryStorageAdapter();
    await exportSource.put("providers", {
      id: "gemini",
      name: "Google Gemini",
      kind: "cloud",
      status: "configured",
      roles: { interviewer: "gemini-1.5-flash", evaluator: "gemini-1.5-flash" },
      encryptedKey: "secret-to-be-stripped",
    });

    const backupFile = await buildExport(exportSource, { includeKeys: false });
    await executeImport(storage, backupFile, { mode: "merge" });

    const provider = await storage.get<ProviderRow>("providers", "gemini");
    expect(provider).toBeDefined();
    expect(provider?.encryptedKey).toBe("existing-encrypted-key-secret");
    expect(provider?.key).toBe("existing-plain-key");
  });
});

describe("M2.5: Per-session delete and cascade cleanup (FR-019)", () => {
  it("deletes a single session, its turns, and related review queue items, updating skill stats", async () => {
    const storage = await createPopulatedStorage();

    // Verify initial counts
    const initialSessions = await storage.getAll<SessionRow>("sessions");
    expect(initialSessions.length).toBe(2);
    const initialTurns = await storage.getAll<TurnRow>("turns");
    expect(initialTurns.length).toBe(2);

    // Delete session 1
    const result = await deleteSession(storage, "sess_1");
    expect(result.deletedSessionId).toBe("sess_1");
    expect(result.deletedTurnsCount).toBe(1);

    // Session 1 is gone, Session 2 remains
    const remainingSessions = await storage.getAll<SessionRow>("sessions");
    expect(remainingSessions.length).toBe(1);
    expect(remainingSessions[0]?.id).toBe("sess_2");

    // Turn 1 is gone, Turn 2 remains
    const remainingTurns = await storage.getAll<TurnRow>("turns");
    expect(remainingTurns.length).toBe(1);
    expect(remainingTurns[0]?.id).toBe("turn_2");

    // Review queue item pointing to turn 1 was removed
    const queue = await storage.getAll("reviewQueue");
    expect(queue.length).toBe(0);

    // Skill stats reflect only remaining session
    const stats = await storage.getAll<{ skillId: string }>("skillStats");
    expect(stats.some((s) => s.skillId === "communication")).toBe(true);
  });
});
