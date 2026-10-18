// Phase 3 Exit Gate Verification (phases.md Section 3 & 7, FR-022, FR-023, FR-024, FR-011, FR-012, AI-014, ADR-013)
// Acceptance Criteria:
// - A full offline text session completes on a reference PC (zero network egress, text-only)
// - Owner review of honesty labels ("basic feedback") across scorecard and evaluation
// - Device rules enforcement (mobile blocking, PC-only, text-only, no speech services)
// - Curated models catalog integrity and post-load sanity verification

import { describe, expect, it, vi } from "vitest";
import {
  computeSessionScorecard,
  detectHardwareCapabilities,
  evaluateAnswer,
  MemoryStorageAdapter,
  MockProviderAdapter,
  SessionRunner,
  runModelSanityTest,
  type ChatMessage,
  type GenerateOptions,
  type HardwareRuntime,
  type ProviderAdapter,
  type SelectedQuestion,
  type SessionPlan,
  type SessionRow,
  type TurnRow,
} from "@abhyas/core";
import { CANONICAL_RUBRICS, CURATED_MODELS } from "@abhyas/content";

describe("Phase 3 Exit Gate (phases.md Section 3 & 7)", () => {
  const midPlan: SessionPlan = {
    sessionId: "p3-exit-session",
    level: "mid",
    targetRole: "Full Stack Engineer",
    type: "technical",
    length: 2,
    style: "standard",
    inputMode: "text",
    createdAt: "2026-10-18T10:00:00.000Z",
  };

  const sampleQuestions: SelectedQuestion[] = [
    {
      id: "q-1",
      text: "How do you handle state management across deeply nested components in React?",
      type: "technical",
      level: "mid",
      skillTags: ["frameworks", "architecture"],
      difficulty: 3,
    },
    {
      id: "q-2",
      text: "Describe how you optimize database queries when dealing with large volumes of relational data.",
      type: "technical",
      level: "mid",
      skillTags: ["database", "performance"],
      difficulty: 3,
    },
  ];

  // 1. A full offline text session on a reference PC
  describe("Exit Criterion 1: Full offline text session on a reference PC (FR-022, FR-011, ADR-013)", () => {
    it("completes a full 2-question text interview session offline with zero network egress", async () => {
      // Mock offline browser status
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });

      // Track any window.fetch calls to guarantee 100% offline isolation
      const fetchSpy = vi.fn();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      try {
        const storage = new MemoryStorageAdapter();

        // Configure local in-browser WebLLM provider
        await storage.put("providers", {
          id: "webllm",
          kind: "webllm",
          modelRoles: { interviewer: "SmolLM2-1.7B-Instruct-q4f16_1-MLC" },
        });

        // Initialize local provider adapter
        const localProvider = new MockProviderAdapter({
          id: "webllm",
          mockObjectResponse: {
            criteria: {
              relevance: { score: 4, reason: "Direct", evidence: "Context API and Zustand" },
              structure: { score: 4, reason: "Logical", evidence: "Component hierarchy" },
              depth: { score: 4, reason: "Good", evidence: "Tradeoffs explained" },
              clarity: { score: 4, reason: "Clear", evidence: "Clear terminology" },
              levelFit: { score: 4, reason: "Appropriate", evidence: "Appropriate for mid level" },
            },
            skillScores: { frameworks: 80, architecture: 75, database: 80, performance: 75 },
            topFix: "Consider explaining server-side cache invalidation strategies.",
            unsupportedClaims: [],
          },
        });

        const runner = new SessionRunner({
          plan: midPlan,
          questions: sampleQuestions,
          storage,
          provider: localProvider,
          providerId: "webllm",
          modelId: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
          autoStart: false,
        });

        // 1. Start session
        await runner.dispatch({ type: "START" });
        expect(runner.getState().status).toBe("await_answer");
        expect(runner.getState().context.currentQuestionIndex).toBe(0);

        // 2. Submit Answer 1
        await runner.dispatch({
          type: "SUBMIT",
          answerText:
            "I evaluate whether the state is local, shared among a subtree, or global. For subtree state, I use React Context with memoization. For truly global or frequent updates, I reach for lightweight stores like Zustand to avoid unnecessary re-renders.",
        });

        // Verify Turn 1 scored and saved
        const turnsAfterQ1 = (await storage.getAll("turns")) as TurnRow[];
        expect(turnsAfterQ1.length).toBe(1);
        expect(turnsAfterQ1[0]?.questionId).toBe("q-1");
        expect(turnsAfterQ1[0]?.evaluation).toBeDefined();

        // 3. Question 2 is now active
        expect(runner.getState().status).toBe("await_answer");
        expect(runner.getState().context.currentQuestionIndex).toBe(1);

        // 4. Submit Answer 2
        await runner.dispatch({
          type: "SUBMIT",
          answerText:
            "I analyze the query execution plan with EXPLAIN ANALYZE to identify sequential scans and missing indexes. I add composite indexes where appropriate, avoid SELECT *, and paginate results using keyset pagination instead of offset.",
        });

        // 5. Complete Session: 2/2 questions completed -> enters results
        expect(runner.getState().status).toBe("results");

        // Verify storage persistence
        const allSessions = (await storage.getAll("sessions")) as SessionRow[];
        expect(allSessions.length).toBe(1);
        expect(allSessions[0]?.modality).toBe("text");
        expect(allSessions[0]?.providerId).toBe("webllm");

        const allTurns = (await storage.getAll("turns")) as TurnRow[];
        expect(allTurns.length).toBe(2);
        expect(allTurns.every((t) => t.status === "scored")).toBe(true);

        // Guarantee zero external network requests took place
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
        globalThis.fetch = originalFetch;
      }
    });
  });

  // 2. Owner review of honesty labels ("basic feedback")
  describe("Exit Criterion 2: Honesty labels ('basic feedback') (AI-014, FR-012, ADR-006)", () => {
    const localSessionRow: SessionRow = {
      id: "session-local-p3",
      createdAt: "2026-10-18T10:00:00.000Z",
      startedAt: "2026-10-18T10:01:00.000Z",
      endedAt: "2026-10-18T10:15:00.000Z",
      modality: "text",
      status: "completed",
      targetRole: "Full Stack Engineer",
      level: "mid",
      providerId: "webllm",
      plan: midPlan,
      summary: "Full offline session using in-browser local model.",
    };

    const localTurns: TurnRow[] = [
      {
        id: "turn-p3-1",
        sessionId: "session-local-p3",
        questionId: "q-1",
        questionText: "How do you manage complex component state in React?",
        answerText: "I use React context for subtree sharing and Zustand for global state.",
        turnIndex: 0,
        followUpCount: 0,
        status: "scored",
        evaluation: {
          criteria: {
            relevance: { score: 4, reason: "Relevant", evidence: "Zustand for global state" },
            structure: { score: 4, reason: "Structured", evidence: "Context for subtree" },
            depth: { score: 3, reason: "Adequate", evidence: "State management pattern" },
            clarity: { score: 4, reason: "Clear", evidence: "Concise answer" },
            levelFit: { score: 4, reason: "Fit", evidence: "Mid-level depth" },
          },
          skillScores: { frameworks: 75, architecture: 75 },
          topFix: "Add memoization details",
          unsupportedClaims: [],
          isBasic: true,
        },
      },
    ];

    it("flags isBasicFeedback = true on session scorecard for WebLLM provider", () => {
      const scorecard = computeSessionScorecard(localSessionRow, localTurns);
      expect(scorecard.isBasicFeedback).toBe(true);
      expect(scorecard.modality).toBe("text");
      // Speech delivery metrics are cleanly omitted for text sessions
      expect(scorecard.deliveryAverages).toBeUndefined();
    });

    it("flags isBasicFeedback = true when turns contain basic evaluation", () => {
      const customLocalSession: SessionRow = {
        ...localSessionRow,
        providerId: "ollama",
      };
      const scorecard = computeSessionScorecard(customLocalSession, localTurns);
      expect(scorecard.isBasicFeedback).toBe(true);
    });

    it("evaluates using rule-based fallback when model returns invalid JSON (AI-014, crash-proof)", async () => {
      // Mock provider that returns invalid non-JSON string
      const failingProvider = new MockProviderAdapter({
        id: "webllm",
        generateTextResponse: "Sorry, I cannot produce structured JSON in this format.",
      });

      const evalRes = await evaluateAnswer({
        question: sampleQuestions[0]!,
        answerText:
          "I use React Context for subtree state and Zustand for global application state with memoization.",
        level: "mid",
        provider: failingProvider,
        rubric: CANONICAL_RUBRICS.mid,
      });

      expect(evalRes.isBasic).toBe(true);
      if (evalRes.status === "scored") {
        expect(evalRes.evaluation.criteria.relevance.score).toBeGreaterThanOrEqual(1);
        expect(evalRes.evaluation.criteria.clarity.score).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // 3. Device rules enforcement
  describe("Exit Criterion 3: Device rules enforcement (FR-022, ADR-013)", () => {
    it("strictly blocks local mode on mobile devices (phones/tablets)", async () => {
      const mobileRuntime: HardwareRuntime = {
        hasWebGpu: vi.fn().mockResolvedValue(false),
        isMobileDevice: vi.fn().mockReturnValue(true),
      };

      const result = await detectHardwareCapabilities(mobileRuntime);
      expect(result.supported).toBe(false);
      expect(result.isMobile).toBe(true);
      expect(result.unsupportedReason).toContain("Local models are disabled on mobile devices");
      expect(result.unsupportedReason).toContain("desktop computers");
    });

    it("allows local mode on desktop PC with WebGPU and detects adapter info", async () => {
      const desktopRuntime: HardwareRuntime = {
        hasWebGpu: vi.fn().mockResolvedValue(true),
        getAdapterInfo: vi.fn().mockResolvedValue({
          vendor: "nvidia",
          architecture: "ada-lovelace",
          description: "NVIDIA GeForce RTX 4080",
        }),
        getConcurrency: () => 16,
        getDeviceMemoryGb: () => 32,
        getStorageQuotaMb: async () => 100_000,
        isMobileDevice: () => false,
      };

      const result = await detectHardwareCapabilities(desktopRuntime);
      expect(result.supported).toBe(true);
      expect(result.isMobile).toBe(false);
      expect(result.webGpuAvailable).toBe(true);
      expect(result.adapterInfo?.vendor).toBe("nvidia");
    });
  });

  // 4. Curated models catalog integrity & sanity test
  describe("Exit Criterion 4: Curated models catalog and post-load sanity verification (FR-023, AI-006)", () => {
    it("contains between 3 and 5 curated models across all 3 hardware tiers", () => {
      expect(CURATED_MODELS.length).toBeGreaterThanOrEqual(3);
      expect(CURATED_MODELS.length).toBeLessThanOrEqual(5);

      const tiers = new Set(CURATED_MODELS.map((m) => m.minimumTier));
      expect(tiers.has("basic")).toBe(true);
      expect(tiers.has("standard")).toBe(true);
      expect(tiers.has("advanced")).toBe(true);
    });

    it("verifies post-load sanity test passes with interview-ready rating", async () => {
      const testSanityProvider: ProviderAdapter = {
        id: "webllm",
        capabilities: async () => ({
          streaming: true,
          jsonMode: "prompted",
          maxContextTokens: 4096,
        }),
        listModels: async () => ({
          ok: true,
          value: [{ id: "test-model", label: "Test Model" }],
        }),
        testConnection: async () => ({ ok: true, value: undefined }),
        stream: (messages: ChatMessage[], opts: GenerateOptions) => {
          if (opts.signal.aborted) {
            throw new Error("Aborted");
          }
          const prompt = messages[messages.length - 1]?.content ?? "";
          return (async function* () {
            if (prompt.includes("array and a linked list")) {
              yield {
                delta: "An array stores elements consecutively in contiguous memory. ",
                isComplete: false,
              };
              yield {
                delta: "A linked list uses nodes pointing to next memory locations.",
                isComplete: true,
              };
            } else if (prompt.includes("READY")) {
              yield { delta: "READY", isComplete: true };
            } else if (prompt.includes("JSON")) {
              yield {
                delta: JSON.stringify({ ready: true, role: "interviewer" }),
                isComplete: true,
              };
            }
          })();
        },
        generateObject: async () => {
          throw new Error("Not implemented");
        },
      };

      const sanity = await runModelSanityTest(
        testSanityProvider,
        "SmolLM2-1.7B-Instruct-q4f16_1-MLC"
      );
      expect(sanity.instructionFollowing).toBe(true);
      expect(sanity.jsonValid).toBe(true);
      expect(sanity.status).toBe("interview-ready");
    });
  });
});
