// FR-008, FR-011: Comprehensive state machine and session runner tests.
// Acceptance criteria:
// - Every transition and failure path covered by tests
// - Session survives a provider failure through the recovery state
// - Turn and session persistence verified
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderAdapter } from "../providers/types.js";
import type { Evaluation } from "../schemas/evaluation.schema.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";
import type { TurnRow } from "../schemas/storage-rows.schema.js";
import { MemoryStorageAdapter } from "../storage/memory-storage.js";
import { SessionRunner } from "./session-runner.js";
import {
  createInitialInterviewState,
  interviewReducer,
  type ActiveQuestion,
  type InterviewState,
} from "./state-machine.js";

// --- Test Fixtures ---------------------------------------------------------

function makePlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionId: "sess-test-123",
    type: "technical",
    length: 5,
    style: "standard",
    inputMode: "text",
    level: "mid",
    targetRole: "Software Engineer",
    createdAt: "2026-10-15T12:00:00.000Z",
    ...overrides,
  };
}

function makeQuestions(count = 5): SelectedQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-${i + 1}`,
    bankId: `bank-${i + 1}`,
    isUnverified: false,
    skillTags: ["frontend", "communication"],
    difficulty: 0.5,
    text: `Sample question ${i + 1} for technical evaluation.`,
    rationale: `Selected for question slot ${i + 1}`,
  }));
}

function sampleEvaluation(): Evaluation {
  return {
    criteria: {
      relevance: { score: 4, reason: "Direct answer", evidence: "Verbatim quote" },
      structure: { score: 4, reason: "STAR used", evidence: "Situation and action" },
      depth: { score: 3, reason: "Adequate depth", evidence: "Technical terms" },
      clarity: { score: 4, reason: "Clear", evidence: "Concise phrasing" },
      levelFit: { score: 4, reason: "Appropriate for mid", evidence: "Solid rationale" },
    },
    skillScores: { frontend: 80 },
    topFix: "Add more quantified outcomes to your response.",
    unsupportedClaims: [],
  };
}

// ---------------------------------------------------------------------------
// Pure State Machine Unit Tests
// ---------------------------------------------------------------------------

describe("Interview State Machine (FR-008, FR-011)", () => {
  describe("State transitions from 'setup'", () => {
    it("transitions from setup to intro on START", () => {
      const state = createInitialInterviewState(makePlan(), makeQuestions());
      const res = interviewReducer(state, { type: "START" });

      expect(res.state.status).toBe("intro");
      expect(res.effects).toContainEqual({ type: "PERSIST_SESSION", status: "active" });
      expect(res.effects).toContainEqual({ type: "PREPARE_INTRO" });
    });

    it("ignores illegal events in setup", () => {
      const state = createInitialInterviewState(makePlan(), makeQuestions());
      const res = interviewReducer(state, { type: "SKIP" });

      expect(res.state.status).toBe("setup");
      expect(res.effects).toEqual([]);
    });
  });

  describe("State transitions from 'intro'", () => {
    it("transitions from intro to ask on INTRO_DONE with first question", () => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const introState = interviewReducer(init, { type: "START" }).state;

      const res = interviewReducer(introState, { type: "INTRO_DONE" });
      expect(res.state.status).toBe("ask");
      expect(res.state.context.currentQuestion?.id).toBe("q-1");
      expect(res.effects).toContainEqual({ type: "LOAD_QUESTION", questionIndex: 0 });
    });

    it("transitions from intro to ended on END", () => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const introState = interviewReducer(init, { type: "START" }).state;

      const res = interviewReducer(introState, { type: "END" });
      expect(res.state.status).toBe("ended");
      expect(
        res.effects.some((e) => e.type === "PERSIST_SESSION" && e.status === "abandoned")
      ).toBe(true);
    });
  });

  describe("State transitions from 'ask'", () => {
    let askState: InterviewState;

    beforeEach(() => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const intro = interviewReducer(init, { type: "START" }).state;
      askState = interviewReducer(intro, { type: "INTRO_DONE" }).state;
    });

    it("transitions to await_answer on QUESTION_READY", () => {
      const activeQ: ActiveQuestion = {
        id: "q-1",
        text: "Sample text",
        difficulty: 0.5,
        skillTags: ["frontend"],
        isUnverified: false,
        followUpCount: 0,
      };

      const res = interviewReducer(askState, { type: "QUESTION_READY", question: activeQ });
      expect(res.state.status).toBe("await_answer");
      expect(res.state.context.currentQuestion?.text).toBe("Sample text");
    });

    it("transitions to error_recoverable on GEN_FAILED", () => {
      const res = interviewReducer(askState, {
        type: "GEN_FAILED",
        error: { kind: "network", message: "Failed to generate" },
      });
      expect(res.state.status).toBe("error_recoverable");
      expect(res.state.context.recoverableError?.failedAction).toBe("generate_question");
    });

    it("transitions to paused on PAUSE", () => {
      const res = interviewReducer(askState, { type: "PAUSE" });
      expect(res.state.status).toBe("paused");
      expect(res.state.context.pausedFromState).toBe("ask");
    });

    it("transitions to ended on END", () => {
      const res = interviewReducer(askState, { type: "END" });
      expect(res.state.status).toBe("ended");
      expect(
        res.effects.some((e) => e.type === "PERSIST_SESSION" && e.status === "abandoned")
      ).toBe(true);
    });
  });

  describe("State transitions from 'await_answer'", () => {
    let awaitState: InterviewState;

    beforeEach(() => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const intro = interviewReducer(init, { type: "START" }).state;
      const ask = interviewReducer(intro, { type: "INTRO_DONE" }).state;
      const activeQ: ActiveQuestion = {
        id: "q-1",
        text: "Question 1 text",
        difficulty: 0.5,
        skillTags: ["frontend"],
        isUnverified: false,
        followUpCount: 0,
      };
      awaitState = interviewReducer(ask, { type: "QUESTION_READY", question: activeQ }).state;
    });

    it("transitions to evaluate on SUBMIT with turn created", () => {
      const res = interviewReducer(awaitState, {
        type: "SUBMIT",
        answerText: "My technical answer.",
      });

      expect(res.state.status).toBe("evaluate");
      expect(res.state.context.turns).toHaveLength(1);
      expect(res.state.context.turns[0]?.answerText).toBe("My technical answer.");
      expect(res.effects).toContainEqual(expect.objectContaining({ type: "EVALUATE_TURN" }));
    });

    it("transitions to ask on SKIP with skipped turn persisted", () => {
      const res = interviewReducer(awaitState, { type: "SKIP" });

      expect(res.state.status).toBe("ask");
      expect(res.state.context.turns).toHaveLength(1);
      expect(res.state.context.turns[0]?.answerText).toBe("[Skipped]");
      expect(res.effects).toContainEqual(expect.objectContaining({ type: "PERSIST_TURN" }));
    });

    it("stays in await_answer on HINT and requests hint generation", () => {
      const res = interviewReducer(awaitState, { type: "HINT" });

      expect(res.state.status).toBe("await_answer");
      expect(res.effects).toContainEqual(expect.objectContaining({ type: "GENERATE_HINT" }));
    });

    it("updates hintText on HINT_READY", () => {
      const res = interviewReducer(awaitState, {
        type: "HINT_READY",
        hintText: "Remember edge cases.",
      });

      expect(res.state.status).toBe("await_answer");
      expect(res.state.context.hintText).toBe("Remember edge cases.");
    });

    it("sets repeatRequested on REPEAT", () => {
      const res = interviewReducer(awaitState, { type: "REPEAT" });

      expect(res.state.status).toBe("await_answer");
      expect(res.state.context.repeatRequested).toBe(true);
    });

    it("handles TIMEOUT and transitions to follow_up_or_next", () => {
      const res = interviewReducer(awaitState, { type: "TIMEOUT" });

      expect(res.state.status).toBe("follow_up_or_next");
      expect(res.state.context.turns[0]?.answerText).toBe("[Time expired]");
    });

    it("transitions to paused on PAUSE", () => {
      const res = interviewReducer(awaitState, { type: "PAUSE" });

      expect(res.state.status).toBe("paused");
      expect(res.state.context.pausedFromState).toBe("await_answer");
    });
  });

  describe("Pause and resume flow", () => {
    it("resumes from paused back to await_answer", () => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const intro = interviewReducer(init, { type: "START" }).state;
      const ask = interviewReducer(intro, { type: "INTRO_DONE" }).state;
      const awaitState = interviewReducer(ask, {
        type: "QUESTION_READY",
        question: {
          id: "q-1",
          text: "Q1",
          difficulty: 0.5,
          skillTags: ["dsa"],
          isUnverified: false,
          followUpCount: 0,
        },
      }).state;

      const paused = interviewReducer(awaitState, { type: "PAUSE" }).state;
      expect(paused.status).toBe("paused");

      const resumed = interviewReducer(paused, { type: "RESUME" }).state;
      expect(resumed.status).toBe("await_answer");
      expect(resumed.context.pausedFromState).toBeUndefined();
    });

    it("ends session cleanly from paused on END", () => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const paused: InterviewState = {
        status: "paused",
        context: { ...init.context, pausedFromState: "await_answer" },
      };

      const res = interviewReducer(paused, { type: "END" });
      expect(res.state.status).toBe("ended");
      expect(
        res.effects.some((e) => e.type === "PERSIST_SESSION" && e.status === "abandoned")
      ).toBe(true);
    });
  });

  describe("State transitions from 'evaluate'", () => {
    let evalState: InterviewState;

    beforeEach(() => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const intro = interviewReducer(init, { type: "START" }).state;
      const ask = interviewReducer(intro, { type: "INTRO_DONE" }).state;
      const awaitState = interviewReducer(ask, {
        type: "QUESTION_READY",
        question: {
          id: "q-1",
          text: "Q1",
          difficulty: 0.5,
          skillTags: ["dsa"],
          isUnverified: false,
          followUpCount: 0,
        },
      }).state;
      evalState = interviewReducer(awaitState, {
        type: "SUBMIT",
        answerText: "My response.",
      }).state;
    });

    it("transitions to follow_up_or_next on SCORED and persists scored turn", () => {
      const evalData = sampleEvaluation();
      const res = interviewReducer(evalState, { type: "SCORED", evaluation: evalData });

      expect(res.state.status).toBe("follow_up_or_next");
      expect(res.state.context.turns[0]?.status).toBe("scored");
      expect(res.state.context.turns[0]?.evaluation).toEqual(evalData);
      expect(res.effects).toContainEqual(expect.objectContaining({ type: "PERSIST_TURN" }));
      expect(res.effects).toContainEqual(expect.objectContaining({ type: "DECIDE_FOLLOW_UP" }));
    });

    it("survives provider failure and transitions to error_recoverable on SCORE_FAILED (AC)", () => {
      const res = interviewReducer(evalState, {
        type: "SCORE_FAILED",
        error: { kind: "quota", message: "Rate limit exceeded" },
      });

      expect(res.state.status).toBe("error_recoverable");
      expect(res.state.context.recoverableError?.failedAction).toBe("evaluate");
      expect(res.state.context.recoverableError?.kind).toBe("quota");
    });
  });

  describe("Follow-up capping and progression in 'follow_up_or_next'", () => {
    let followUpState: InterviewState;

    beforeEach(() => {
      const init = createInitialInterviewState(makePlan({ length: 5 }), makeQuestions(5));
      followUpState = {
        status: "follow_up_or_next",
        context: {
          ...init.context,
          currentQuestionIndex: 0,
          currentQuestion: {
            id: "q-1",
            text: "Q1",
            difficulty: 0.5,
            skillTags: ["backend_apis"],
            isUnverified: false,
            followUpCount: 0,
          },
          turns: [],
        },
      };
    });

    it("allows up to 2 follow-ups per question (FR-008)", () => {
      // First follow-up (0 -> 1)
      const f1 = interviewReducer(followUpState, {
        type: "FOLLOW_UP",
        question: {
          id: "q1-f1",
          text: "Tell me more about scaling.",
          difficulty: 0.5,
          skillTags: ["backend_apis"],
          isUnverified: false,
          followUpCount: 1,
        },
      }).state;

      expect(f1.status).toBe("ask");
      expect(f1.context.currentQuestion?.followUpCount).toBe(1);

      // Second follow-up (1 -> 2)
      const followUpState2: InterviewState = {
        ...f1,
        status: "follow_up_or_next",
      };
      const f2 = interviewReducer(followUpState2, {
        type: "FOLLOW_UP",
        question: {
          id: "q1-f2",
          text: "How did you monitor memory?",
          difficulty: 0.5,
          skillTags: ["backend_apis"],
          isUnverified: false,
          followUpCount: 2,
        },
      }).state;

      expect(f2.status).toBe("ask");
      expect(f2.context.currentQuestion?.followUpCount).toBe(2);

      // Attempting a third follow-up when count is 2 automatically advances to NEXT
      const followUpState3: InterviewState = {
        ...f2,
        status: "follow_up_or_next",
      };
      const f3 = interviewReducer(followUpState3, {
        type: "FOLLOW_UP",
        question: {
          id: "q1-f3",
          text: "Extra question",
          difficulty: 0.5,
          skillTags: [],
          isUnverified: false,
          followUpCount: 3,
        },
      }).state;

      // Should automatically advance to NEXT (question index 1)
      expect(f3.status).toBe("ask");
      expect(f3.context.currentQuestionIndex).toBe(1);
    });

    it("advances to next question on NEXT", () => {
      const res = interviewReducer(followUpState, { type: "NEXT" });

      expect(res.state.status).toBe("ask");
      expect(res.state.context.currentQuestionIndex).toBe(1);
    });

    it("transitions to wrap_up on NEXT when all planned questions are completed", () => {
      const lastQState: InterviewState = {
        ...followUpState,
        context: {
          ...followUpState.context,
          currentQuestionIndex: 4, // at length 5, index 4 is the last
        },
      };

      const res = interviewReducer(lastQState, { type: "NEXT" });
      expect(res.state.status).toBe("wrap_up");
      expect(res.effects).toContainEqual({ type: "PREPARE_WRAP_UP" });
    });
  });

  describe("Error recovery options in 'error_recoverable'", () => {
    let errorState: InterviewState;

    beforeEach(() => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      errorState = {
        status: "error_recoverable",
        context: {
          ...init.context,
          recoverableError: {
            kind: "network",
            message: "Temporary connection reset",
            failedAction: "evaluate",
          },
          turns: [
            {
              id: "t-1",
              index: 0,
              questionId: "q-1",
              isUnverifiedQuestion: false,
              skillTags: ["frontend"],
              difficulty: 0.5,
              questionText: "Q1",
              answerText: "Answer 1",
              status: "unscored",
            },
          ],
        },
      };
    });

    it("retries failed evaluation on RETRY", () => {
      const res = interviewReducer(errorState, { type: "RETRY" });

      expect(res.state.status).toBe("evaluate");
      expect(res.state.context.recoverableError).toBeUndefined();
      expect(res.effects).toContainEqual(expect.objectContaining({ type: "EVALUATE_TURN" }));
    });

    it("switches to text mode on SWITCH_TO_TEXT", () => {
      const voicePlan = makePlan({ inputMode: "voice" });
      const voiceErrState: InterviewState = {
        ...errorState,
        context: { ...errorState.context, plan: voicePlan },
      };

      const res = interviewReducer(voiceErrState, { type: "SWITCH_TO_TEXT" });

      expect(res.state.status).toBe("await_answer");
      expect(res.state.context.plan.inputMode).toBe("text");
      expect(res.state.context.recoverableError).toBeUndefined();
    });

    it("saves partial session on SAVE_PARTIAL and transitions to ended", () => {
      const res = interviewReducer(errorState, { type: "SAVE_PARTIAL" });

      expect(res.state.status).toBe("ended");
      expect(
        res.effects.some((e) => e.type === "PERSIST_SESSION" && e.status === "abandoned")
      ).toBe(true);
    });

    it("ends session cleanly on END", () => {
      const res = interviewReducer(errorState, { type: "END" });

      expect(res.state.status).toBe("ended");
      expect(
        res.effects.some((e) => e.type === "PERSIST_SESSION" && e.status === "abandoned")
      ).toBe(true);
    });
  });

  describe("Wrap up and results", () => {
    it("transitions from wrap_up to results on DONE and marks session completed", () => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const wrapState: InterviewState = {
        status: "wrap_up",
        context: init.context,
      };

      const res = interviewReducer(wrapState, { type: "DONE" });
      expect(res.state.status).toBe("results");
      expect(
        res.effects.some((e) => e.type === "PERSIST_SESSION" && e.status === "completed")
      ).toBe(true);
    });

    it("results state is terminal and ignores events", () => {
      const init = createInitialInterviewState(makePlan(), makeQuestions());
      const resultsState: InterviewState = {
        status: "results",
        context: init.context,
      };

      const res = interviewReducer(resultsState, { type: "START" });
      expect(res.state.status).toBe("results");
      expect(res.effects).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Session Runner Integration Tests
// ---------------------------------------------------------------------------

describe("SessionRunner Integration (FR-008, FR-011)", () => {
  it("runs a multi-question text session end-to-end and persists turns", async () => {
    const storage = new MemoryStorageAdapter();
    const plan = makePlan({ length: 5 });
    const questions = makeQuestions(5);

    const runner = new SessionRunner({
      plan,
      questions,
      storage,
      autoStart: true,
    });

    // Wait for auto-start to enter await_answer
    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("await_answer");
    });

    // Answer Question 1
    await runner.dispatch({
      type: "SUBMIT",
      answerText: "Detailed answer explaining microfrontends, bundling, and CSS scoping.",
    });

    // Evaluator will score and advance to follow_up_or_next, then next question (or ask)
    await vi.waitFor(() => {
      const s = runner.getState();
      expect(s.status === "await_answer" || s.status === "ask").toBe(true);
      expect(s.context.turns).toHaveLength(1);
    });

    // Check IndexedDB persistence (NFR-009)
    const savedTurns = await storage.getAll<TurnRow>("turns");
    expect(savedTurns.length).toBeGreaterThanOrEqual(1);
    expect(savedTurns[0]?.answerText).toContain("Detailed answer explaining");

    // Skip remaining questions (questions 2, 3, 4, 5)
    for (let q = 1; q < 5; q++) {
      await vi.waitFor(() => {
        expect(runner.getState().status).toBe("await_answer");
      });
      await runner.dispatch({ type: "SKIP" });
    }

    // Session should advance to results
    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("results");
    });

    // Check sessions table
    const sessions = await storage.getAll("sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toHaveProperty("status", "completed");
  });

  it("handles provider failure during evaluation and recovers on RETRY (AC)", async () => {
    const storage = new MemoryStorageAdapter();
    const plan = makePlan({ length: 5 });
    const questions = makeQuestions(5);

    // Mock provider that fails on the first call, succeeds on the second
    let attempt = 0;
    const failingProvider: ProviderAdapter = {
      id: "gemini",
      capabilities: async () => ({ streaming: true, jsonMode: "native", maxContextTokens: 32768 }),
      listModels: async () => ({ ok: true, value: [{ id: "m1", label: "M1" }] }),
      testConnection: async () => ({ ok: true, value: undefined }),
      stream: async function* () {},
      generateObject: async <T>() => {
        attempt++;
        if (attempt === 1) {
          return { ok: false, error: { kind: "network", message: "API timeout", retryable: true } };
        }
        return { ok: true, value: sampleEvaluation() as unknown as T };
      },
    };

    const runner = new SessionRunner({
      plan,
      questions,
      storage,
      provider: failingProvider,
      autoStart: true,
    });

    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("await_answer");
    });

    // Submit answer -> triggers evaluation which fails
    await runner.dispatch({ type: "SUBMIT", answerText: "React virtual DOM explanation." });

    // Should transition to error_recoverable (session survives failure!)
    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("error_recoverable");
      expect(runner.getState().context.recoverableError?.message).toBe("API timeout");
    });

    // Trigger RETRY -> should succeed and advance
    await runner.dispatch({ type: "RETRY" });

    await vi.waitFor(() => {
      const s = runner.getState();
      expect(
        s.status === "await_answer" || s.status === "ask" || s.status === "follow_up_or_next"
      ).toBe(true);
      expect(s.context.turns[0]?.status).toBe("scored");
    });
  });
});
