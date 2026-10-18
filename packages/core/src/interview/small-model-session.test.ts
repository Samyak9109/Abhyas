// FR-012, AI-013, AI-014: Full interview session integration test with small local model.
// Verifies:
// 1. A full session completes with a small model
// 2. Invalid/malformed JSON never crashes the session
// 3. Fallback to basic feedback path is executed
// 4. Session scorecard contains isBasicFeedback = true
import { describe, expect, it, vi } from "vitest";
import { SessionRunner } from "./session-runner.js";
import { MemoryStorageAdapter } from "../storage/memory-storage.js";
import { computeSessionScorecard } from "../evaluation/scorecard.js";
import type { ProviderAdapter, StreamChunk } from "../providers/types.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";

function makeSmallModelPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionId: "sess-small-123",
    type: "technical",
    length: 5,
    style: "standard",
    inputMode: "text",
    level: "mid",
    targetRole: "Backend Engineer",
    createdAt: "2026-10-18T10:00:00.000Z",
    ...overrides,
  };
}

const mockQuestions: SelectedQuestion[] = [
  {
    id: "q-1",
    bankId: "bank-1",
    text: "How do you handle slow database queries in production?",
    difficulty: 0.5,
    skillTags: ["databases"],
    isUnverified: false,
    rubricHints: ["EXPLAIN ANALYZE", "Indexes", "Connection Pooling"],
  },
  {
    id: "q-2",
    bankId: "bank-2",
    text: "How do you design an idempotent API endpoint?",
    difficulty: 0.5,
    skillTags: ["backend_apis"],
    isUnverified: false,
    rubricHints: ["Idempotency keys", "Distributed locks", "Transaction isolation"],
  },
  {
    id: "q-3",
    bankId: "bank-3",
    text: "How do you monitor distributed microservices?",
    difficulty: 0.5,
    skillTags: ["devops"],
    isUnverified: false,
  },
  {
    id: "q-4",
    bankId: "bank-4",
    text: "Explain your approach to concurrency control.",
    difficulty: 0.5,
    skillTags: ["backend_apis"],
    isUnverified: false,
  },
  {
    id: "q-5",
    bankId: "bank-5",
    text: "How do you handle schema migrations safely?",
    difficulty: 0.5,
    skillTags: ["databases"],
    isUnverified: false,
  },
];

describe("Small-Model Session Behavior (FR-012, AI-014, PG-13)", () => {
  it("completes a full session with a small model returning malformed JSON without crashing", async () => {
    const storage = new MemoryStorageAdapter();
    const plan = makeSmallModelPlan();

    // Mock small 1.5B/3B local model that streams follow-ups but repeatedly fails JSON generation
    let streamCallCount = 0;
    let generateObjectCallCount = 0;

    const smallLocalProvider: ProviderAdapter = {
      id: "webllm",
      capabilities: async () => ({
        streaming: true,
        jsonMode: "prompted",
        maxContextTokens: 4096,
      }),
      listModels: async () => ({
        ok: true,
        value: [{ id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B" }],
      }),
      testConnection: async () => ({ ok: true, value: undefined }),
      stream: async function* (messages) {
        streamCallCount++;
        // Verify layered context was passed into follow-up prompt (AI-013)
        const systemMsg = messages.find((m) => m.role === "system")?.content || "";
        expect(systemMsg).toContain("Backend Engineer");
        expect(systemMsg).toContain("Level Expectation:");

        const chunks: StreamChunk[] = [
          { delta: "Could you elaborate on ", isComplete: false },
          { delta: "how your indexing strategy ", isComplete: false },
          { delta: "affects write amplification?", isComplete: true },
        ];
        for (const chunk of chunks) {
          yield chunk;
        }
      },
      generateObject: async () => {
        generateObjectCallCount++;
        // Small local models frequently output truncated or invalid JSON
        return {
          ok: false,
          error: {
            kind: "invalid_output",
            message:
              "SyntaxError: Unexpected token '}' in JSON at position 42 (malformed small model JSON)",
            retryable: true,
          },
        };
      },
    };

    const runner = new SessionRunner({
      plan,
      questions: mockQuestions,
      storage,
      provider: smallLocalProvider,
      providerId: "webllm",
      modelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      autoStart: true,
    });

    // 1. Wait for runner to enter await_answer
    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("await_answer");
    });

    const sessionId = runner.getState().context.plan.sessionId;

    // 2. Candidate answers Question 1 with STAR markers and numbers
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "First, I run EXPLAIN ANALYZE on Postgres to identify table scans. Second, I add compound indexes on foreign keys. Finally, query latency drops by 65%.",
    });

    // 3. Evaluator runs: generateObject fails -> retries -> fails -> falls back to createRuleBasedEvaluation with isBasic: true
    // Then decides follow-up: calls provider.stream using buildLayeredInterviewContext -> dispatches FOLLOW_UP
    await vi.waitFor(
      () => {
        const s = runner.getState();
        expect(s.status).toBe("await_answer");
        expect(s.context.currentQuestion?.id).toContain("followup");
      },
      { timeout: 3000 }
    );

    // Verify fallback occurred and generateObject was retried
    expect(generateObjectCallCount).toBeGreaterThanOrEqual(2);
    expect(streamCallCount).toBe(1);

    // Verify first turn was scored and stored as basic feedback
    const turnsAfterQ1 = await storage.getAll<TurnRow>("turns");
    expect(turnsAfterQ1).toHaveLength(1);
    expect(turnsAfterQ1[0]?.status).toBe("scored");
    expect(turnsAfterQ1[0]?.evaluation?.isBasic).toBe(true);

    // 4. Candidate answers follow-up 1
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "Every index introduces write overhead during inserts and updates. Therefore, we monitor index usage and drop unused indexes.",
    });

    // 5. Follow-up 1 evaluated. Cap of 2 follow-ups allows follow-up 2
    await vi.waitFor(
      () => {
        const s = runner.getState();
        expect(s.status).toBe("await_answer");
        expect(s.context.currentQuestion?.id).toContain("followup");
      },
      { timeout: 3000 }
    );

    // 6. Candidate answers follow-up 2
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "We also use partial indexes with WHERE clauses to minimize the indexed row set and reduce storage.",
    });

    // 7. Follow-up cap reached (2 follow-ups), advances to Question 2
    await vi.waitFor(
      () => {
        const s = runner.getState();
        expect(s.status).toBe("await_answer");
        expect(s.context.currentQuestion?.id).toBe("q-2");
      },
      { timeout: 3000 }
    );

    // 8. Skip remaining questions (Q2, Q3, Q4, Q5) to conclude the session
    for (let q = 1; q < 5; q++) {
      await vi.waitFor(() => {
        expect(runner.getState().status).toBe("await_answer");
      });
      await runner.dispatch({ type: "SKIP" });
    }

    // 8. Session should advance to results without any uncaught exceptions or crashes
    await vi.waitFor(
      () => {
        expect(runner.getState().status).toBe("results");
      },
      { timeout: 3000 }
    );

    // 9. Verify storage persistence
    const savedSession = await storage.get<SessionRow>("sessions", sessionId);
    expect(savedSession).toBeDefined();
    expect(savedSession?.status).toBe("completed");

    const allTurns = (await storage.getAll<TurnRow>("turns")).filter(
      (t) => t.sessionId === sessionId
    );
    expect(allTurns.length).toBeGreaterThanOrEqual(3);
    const scoredTurns = allTurns.filter((t) => t.status === "scored");
    expect(scoredTurns.length).toBeGreaterThanOrEqual(2);
    for (const turn of scoredTurns) {
      expect(turn.evaluation).toBeDefined();
      expect(turn.evaluation?.isBasic).toBe(true);
    }

    // 10. Compute Scorecard and verify isBasicFeedback is true
    const scorecard = computeSessionScorecard(savedSession!, allTurns);
    expect(scorecard.sessionId).toBe(sessionId);
    expect(scorecard.isBasicFeedback).toBe(true);
    expect(scorecard.overallScore).toBeGreaterThan(0);
    expect(scorecard.scoredTurnsCount).toBe(scoredTurns.length);
  });
});
