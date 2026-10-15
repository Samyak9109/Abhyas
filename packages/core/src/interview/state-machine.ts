// FR-008, FR-011, ADR-007: Pure deterministic interview state machine.
//
// Implemented as pure functions: (state, event) -> { state, effects }.
// Side-effects (AI calls, storage, audio) are executed by the session runner,
// keeping the state machine 100% unit-testable and predictable.
//
// State Table (architecture.md Section 8):
// - setup             -> START -> intro
// - intro             -> INTRO_DONE -> ask; END -> ended
// - ask               -> QUESTION_READY -> await_answer; GEN_FAILED -> error_recoverable; PAUSE -> paused; END -> ended
// - await_answer      -> SUBMIT -> evaluate; SKIP -> follow_up_or_next; HINT -> await_answer; REPEAT -> await_answer; PAUSE -> paused; TIMEOUT -> evaluate/follow_up_or_next; END -> ended
// - paused            -> RESUME -> (previous state); END -> ended
// - evaluate          -> SCORED -> follow_up_or_next; SCORE_FAILED -> error_recoverable
// - follow_up_or_next -> FOLLOW_UP -> ask; NEXT -> ask / wrap_up; WRAP_UP -> wrap_up
// - wrap_up           -> DONE -> results
// - results           -> terminal
// - error_recoverable -> RETRY -> (retried state); SWITCH_TO_TEXT -> (retried state); SAVE_PARTIAL -> ended; END -> ended
// - ended             -> terminal

import type { Evaluation } from "../schemas/evaluation.schema.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";

// --- Types -----------------------------------------------------------------

export type InterviewStatus =
  | "setup"
  | "intro"
  | "ask"
  | "await_answer"
  | "paused"
  | "evaluate"
  | "follow_up_or_next"
  | "wrap_up"
  | "results"
  | "error_recoverable"
  | "ended";

export interface ActiveQuestion {
  id: string;
  text: string;
  difficulty: number; // 0 to 1
  skillTags: string[];
  isUnverified: boolean;
  followUpCount: number; // 0, 1, or 2 (FR-008 cap)
  parentQuestionId?: string | undefined;
  rubricHints?: string[] | undefined;
  originalBankQuestion?: SelectedQuestion | undefined;
}

export interface CompletedTurn {
  id: string;
  index: number;
  questionId?: string | undefined;
  isUnverifiedQuestion: boolean;
  skillTags: string[];
  difficulty: number;
  questionText: string;
  answerText: string;
  followUpOf?: string | undefined;
  evaluation?: Evaluation | undefined;
  status: "scored" | "unscored";
}

export interface RecoverableError {
  kind: string;
  message: string;
  failedAction: "generate_question" | "evaluate" | "follow_up" | "wrap_up";
}

export interface InterviewContext {
  plan: SessionPlan;
  questions: SelectedQuestion[];
  currentQuestionIndex: number;
  currentQuestion: ActiveQuestion | null;
  turns: CompletedTurn[];
  pausedFromState?: "ask" | "await_answer" | undefined;
  hintText?: string | undefined;
  repeatRequested?: boolean | undefined;
  recoverableError?: RecoverableError | undefined;
}

export interface InterviewState {
  status: InterviewStatus;
  context: InterviewContext;
}

// --- Events ----------------------------------------------------------------

export type InterviewEvent =
  | { type: "START" }
  | { type: "INTRO_DONE" }
  | { type: "QUESTION_READY"; question: ActiveQuestion }
  | { type: "GEN_FAILED"; error: { kind: string; message: string } }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SUBMIT"; answerText: string }
  | { type: "SKIP" }
  | { type: "HINT" }
  | { type: "HINT_READY"; hintText: string }
  | { type: "REPEAT" }
  | { type: "TIMEOUT" }
  | { type: "SCORED"; evaluation: Evaluation }
  | { type: "SCORE_FAILED"; error: { kind: string; message: string } }
  | { type: "FOLLOW_UP"; question: ActiveQuestion }
  | { type: "NEXT" }
  | { type: "WRAP_UP" }
  | { type: "DONE" }
  | { type: "RETRY" }
  | { type: "SWITCH_TO_TEXT" }
  | { type: "SAVE_PARTIAL" }
  | { type: "END" };

// --- Effects ---------------------------------------------------------------

export type InterviewEffect =
  | { type: "PREPARE_INTRO" }
  | { type: "LOAD_QUESTION"; questionIndex: number }
  | { type: "EVALUATE_TURN"; turn: CompletedTurn; plan: SessionPlan }
  | { type: "DECIDE_FOLLOW_UP"; lastTurn: CompletedTurn; followUpCount: number; plan: SessionPlan }
  | { type: "GENERATE_HINT"; question: ActiveQuestion }
  | { type: "PERSIST_TURN"; turn: CompletedTurn; sessionId: string }
  | { type: "PERSIST_SESSION"; status: "active" | "completed" | "abandoned"; endedAt?: string }
  | { type: "PREPARE_WRAP_UP" };

export interface TransitionResult {
  state: InterviewState;
  effects: InterviewEffect[];
}

// ---------------------------------------------------------------------------
// Initial State Factory
// ---------------------------------------------------------------------------

export function createInitialInterviewState(
  plan: SessionPlan,
  questions: SelectedQuestion[]
): InterviewState {
  return {
    status: "setup",
    context: {
      plan,
      questions,
      currentQuestionIndex: 0,
      currentQuestion: null,
      turns: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Transition Function
// ---------------------------------------------------------------------------

export function interviewReducer(state: InterviewState, event: InterviewEvent): TransitionResult {
  const { status, context } = state;

  switch (status) {
    // 1. SETUP
    case "setup": {
      if (event.type === "START") {
        return {
          state: {
            ...state,
            status: "intro",
          },
          effects: [{ type: "PERSIST_SESSION", status: "active" }, { type: "PREPARE_INTRO" }],
        };
      }
      break;
    }

    // 2. INTRO
    case "intro": {
      if (event.type === "INTRO_DONE") {
        // Transition to ask with the first question from bank
        const firstQ = context.questions[context.currentQuestionIndex];
        const nextQ: ActiveQuestion | null = firstQ
          ? {
              id: firstQ.id,
              text: firstQ.text,
              difficulty: firstQ.difficulty,
              skillTags: firstQ.skillTags,
              isUnverified: firstQ.isUnverified,
              followUpCount: 0,
              originalBankQuestion: firstQ,
            }
          : null;

        return {
          state: {
            ...state,
            status: "ask",
            context: {
              ...context,
              currentQuestion: nextQ,
            },
          },
          effects: [{ type: "LOAD_QUESTION", questionIndex: context.currentQuestionIndex }],
        };
      }
      if (event.type === "END") {
        return {
          state: { ...state, status: "ended" },
          effects: [
            { type: "PERSIST_SESSION", status: "abandoned", endedAt: new Date().toISOString() },
          ],
        };
      }
      break;
    }

    // 3. ASK
    case "ask": {
      if (event.type === "QUESTION_READY") {
        return {
          state: {
            ...state,
            status: "await_answer",
            context: {
              ...context,
              currentQuestion: event.question,
              repeatRequested: false,
              hintText: undefined,
            },
          },
          effects: [],
        };
      }
      if (event.type === "GEN_FAILED") {
        return {
          state: {
            ...state,
            status: "error_recoverable",
            context: {
              ...context,
              recoverableError: {
                kind: event.error.kind,
                message: event.error.message,
                failedAction: "generate_question",
              },
            },
          },
          effects: [],
        };
      }
      if (event.type === "PAUSE") {
        return {
          state: {
            ...state,
            status: "paused",
            context: { ...context, pausedFromState: "ask" },
          },
          effects: [],
        };
      }
      if (event.type === "END") {
        return {
          state: { ...state, status: "ended" },
          effects: [
            { type: "PERSIST_SESSION", status: "abandoned", endedAt: new Date().toISOString() },
          ],
        };
      }
      break;
    }

    // 4. AWAIT_ANSWER
    case "await_answer": {
      if (event.type === "SUBMIT") {
        const q = context.currentQuestion;
        const turn: CompletedTurn = {
          id: `turn-${context.plan.sessionId}-${context.turns.length + 1}`,
          index: context.turns.length,
          questionId: q?.id,
          isUnverifiedQuestion: q?.isUnverified ?? false,
          skillTags: q?.skillTags ?? [],
          difficulty: q?.difficulty ?? 0.5,
          questionText: q?.text ?? "",
          answerText: event.answerText,
          ...(q?.parentQuestionId ? { followUpOf: q.parentQuestionId } : {}),
          status: "unscored",
        };

        return {
          state: {
            ...state,
            status: "evaluate",
            context: {
              ...context,
              turns: [...context.turns, turn],
            },
          },
          effects: [{ type: "EVALUATE_TURN", turn, plan: context.plan }],
        };
      }

      if (event.type === "SKIP") {
        const q = context.currentQuestion;
        const turn: CompletedTurn = {
          id: `turn-${context.plan.sessionId}-${context.turns.length + 1}`,
          index: context.turns.length,
          questionId: q?.id,
          isUnverifiedQuestion: q?.isUnverified ?? false,
          skillTags: q?.skillTags ?? [],
          difficulty: q?.difficulty ?? 0.5,
          questionText: q?.text ?? "",
          answerText: "[Skipped]",
          ...(q?.parentQuestionId ? { followUpOf: q.parentQuestionId } : {}),
          status: "unscored",
        };

        const updatedTurns = [...context.turns, turn];
        const nextIdx = context.currentQuestionIndex + 1;
        const isFinished = nextIdx >= context.plan.length;

        return {
          state: {
            ...state,
            status: isFinished ? "wrap_up" : "ask",
            context: {
              ...context,
              currentQuestionIndex: isFinished ? context.currentQuestionIndex : nextIdx,
              turns: updatedTurns,
            },
          },
          effects: [
            { type: "PERSIST_TURN", turn, sessionId: context.plan.sessionId },
            isFinished
              ? { type: "PREPARE_WRAP_UP" }
              : { type: "LOAD_QUESTION", questionIndex: nextIdx },
          ],
        };
      }

      if (event.type === "HINT") {
        if (context.currentQuestion) {
          return {
            state,
            effects: [{ type: "GENERATE_HINT", question: context.currentQuestion }],
          };
        }
        return { state, effects: [] };
      }

      if (event.type === "HINT_READY") {
        return {
          state: {
            ...state,
            context: {
              ...context,
              hintText: event.hintText,
            },
          },
          effects: [],
        };
      }

      if (event.type === "REPEAT") {
        return {
          state: {
            ...state,
            context: { ...context, repeatRequested: true },
          },
          effects: [],
        };
      }

      if (event.type === "TIMEOUT") {
        const q = context.currentQuestion;
        const turn: CompletedTurn = {
          id: `turn-${context.plan.sessionId}-${context.turns.length + 1}`,
          index: context.turns.length,
          questionId: q?.id,
          isUnverifiedQuestion: q?.isUnverified ?? false,
          skillTags: q?.skillTags ?? [],
          difficulty: q?.difficulty ?? 0.5,
          questionText: q?.text ?? "",
          answerText: "[Time expired]",
          ...(q?.parentQuestionId ? { followUpOf: q.parentQuestionId } : {}),
          status: "unscored",
        };

        const updatedTurns = [...context.turns, turn];
        return {
          state: {
            ...state,
            status: "follow_up_or_next",
            context: { ...context, turns: updatedTurns },
          },
          effects: [
            { type: "PERSIST_TURN", turn, sessionId: context.plan.sessionId },
            {
              type: "DECIDE_FOLLOW_UP",
              lastTurn: turn,
              followUpCount: q?.followUpCount ?? 0,
              plan: context.plan,
            },
          ],
        };
      }

      if (event.type === "PAUSE") {
        return {
          state: {
            ...state,
            status: "paused",
            context: { ...context, pausedFromState: "await_answer" },
          },
          effects: [],
        };
      }

      if (event.type === "END") {
        return {
          state: { ...state, status: "ended" },
          effects: [
            { type: "PERSIST_SESSION", status: "abandoned", endedAt: new Date().toISOString() },
          ],
        };
      }
      break;
    }

    // 5. PAUSED
    case "paused": {
      if (event.type === "RESUME") {
        const returnStatus = context.pausedFromState ?? "await_answer";
        return {
          state: {
            ...state,
            status: returnStatus,
            context: { ...context, pausedFromState: undefined },
          },
          effects: [],
        };
      }
      if (event.type === "END") {
        return {
          state: { ...state, status: "ended" },
          effects: [
            { type: "PERSIST_SESSION", status: "abandoned", endedAt: new Date().toISOString() },
          ],
        };
      }
      break;
    }

    // 6. EVALUATE
    case "evaluate": {
      if (event.type === "SCORED") {
        const lastIdx = context.turns.length - 1;
        const lastTurn = context.turns[lastIdx];
        if (!lastTurn) return { state, effects: [] };

        const scoredTurn: CompletedTurn = {
          ...lastTurn,
          evaluation: event.evaluation,
          status: "scored",
        };

        const updatedTurns = [...context.turns.slice(0, lastIdx), scoredTurn];

        return {
          state: {
            ...state,
            status: "follow_up_or_next",
            context: {
              ...context,
              turns: updatedTurns,
            },
          },
          effects: [
            { type: "PERSIST_TURN", turn: scoredTurn, sessionId: context.plan.sessionId },
            {
              type: "DECIDE_FOLLOW_UP",
              lastTurn: scoredTurn,
              followUpCount: context.currentQuestion?.followUpCount ?? 0,
              plan: context.plan,
            },
          ],
        };
      }

      if (event.type === "SCORE_FAILED") {
        // Move to error_recoverable state (FR-008, AC: survives provider failure)
        return {
          state: {
            ...state,
            status: "error_recoverable",
            context: {
              ...context,
              recoverableError: {
                kind: event.error.kind,
                message: event.error.message,
                failedAction: "evaluate",
              },
            },
          },
          effects: [],
        };
      }
      break;
    }

    // 7. FOLLOW_UP_OR_NEXT
    case "follow_up_or_next": {
      if (event.type === "FOLLOW_UP") {
        // At most 2 follow-ups per question (FR-008)
        const currentCount = context.currentQuestion?.followUpCount ?? 0;
        if (currentCount < 2) {
          const followUpQ: ActiveQuestion = {
            ...event.question,
            followUpCount: currentCount + 1,
            parentQuestionId:
              context.currentQuestion?.parentQuestionId ?? context.currentQuestion?.id,
          };
          return {
            state: {
              ...state,
              status: "ask",
              context: {
                ...context,
                currentQuestion: followUpQ,
              },
            },
            effects: [],
          };
        }
        // If cap reached, advance to next question
        return interviewReducer(state, { type: "NEXT" });
      }

      if (event.type === "NEXT") {
        const nextIdx = context.currentQuestionIndex + 1;
        if (nextIdx < context.plan.length && nextIdx < context.questions.length) {
          const nextSelected = context.questions[nextIdx]!;
          const nextQ: ActiveQuestion = {
            id: nextSelected.id,
            text: nextSelected.text,
            difficulty: nextSelected.difficulty,
            skillTags: nextSelected.skillTags,
            isUnverified: nextSelected.isUnverified,
            followUpCount: 0,
            originalBankQuestion: nextSelected,
          };

          return {
            state: {
              ...state,
              status: "ask",
              context: {
                ...context,
                currentQuestionIndex: nextIdx,
                currentQuestion: nextQ,
              },
            },
            effects: [{ type: "LOAD_QUESTION", questionIndex: nextIdx }],
          };
        }

        // Reached end of questions -> wrap_up
        return {
          state: {
            ...state,
            status: "wrap_up",
          },
          effects: [{ type: "PREPARE_WRAP_UP" }],
        };
      }

      if (event.type === "WRAP_UP") {
        return {
          state: {
            ...state,
            status: "wrap_up",
          },
          effects: [{ type: "PREPARE_WRAP_UP" }],
        };
      }
      break;
    }

    // 8. WRAP_UP
    case "wrap_up": {
      if (event.type === "DONE") {
        return {
          state: {
            ...state,
            status: "results",
          },
          effects: [
            {
              type: "PERSIST_SESSION",
              status: "completed",
              endedAt: new Date().toISOString(),
            },
          ],
        };
      }
      break;
    }

    // 9. ERROR_RECOVERABLE
    case "error_recoverable": {
      if (event.type === "RETRY") {
        const action = context.recoverableError?.failedAction;
        if (action === "evaluate") {
          const lastTurn = context.turns[context.turns.length - 1];
          if (lastTurn) {
            return {
              state: {
                ...state,
                status: "evaluate",
                context: { ...context, recoverableError: undefined },
              },
              effects: [{ type: "EVALUATE_TURN", turn: lastTurn, plan: context.plan }],
            };
          }
        }
        if (action === "generate_question") {
          return {
            state: {
              ...state,
              status: "ask",
              context: { ...context, recoverableError: undefined },
            },
            effects: [{ type: "LOAD_QUESTION", questionIndex: context.currentQuestionIndex }],
          };
        }
        // Fallback: resume to await_answer
        return {
          state: {
            ...state,
            status: "await_answer",
            context: { ...context, recoverableError: undefined },
          },
          effects: [],
        };
      }

      if (event.type === "SWITCH_TO_TEXT") {
        // Enforce text modality and clear error
        const updatedPlan: SessionPlan = {
          ...context.plan,
          inputMode: "text",
        };
        return {
          state: {
            ...state,
            status: "await_answer",
            context: {
              ...context,
              plan: updatedPlan,
              recoverableError: undefined,
            },
          },
          effects: [],
        };
      }

      if (event.type === "SAVE_PARTIAL") {
        return {
          state: {
            ...state,
            status: "ended",
            context: { ...context, recoverableError: undefined },
          },
          effects: [
            {
              type: "PERSIST_SESSION",
              status: "abandoned",
              endedAt: new Date().toISOString(),
            },
          ],
        };
      }

      if (event.type === "END") {
        return {
          state: {
            ...state,
            status: "ended",
            context: { ...context, recoverableError: undefined },
          },
          effects: [
            {
              type: "PERSIST_SESSION",
              status: "abandoned",
              endedAt: new Date().toISOString(),
            },
          ],
        };
      }
      break;
    }

    // 10. RESULTS & ENDED (Terminal)
    case "results":
    case "ended": {
      // Terminal states ignore all events
      break;
    }
  }

  // Illegal event for current status: ignore and return unmodified state (architecture.md Section 8)
  return { state, effects: [] };
}
