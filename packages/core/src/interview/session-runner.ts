// FR-008, FR-011, NFR-009, ADR-007: Session runner — effect executor and state coordinator.
// Manages the state machine, executes side-effects (AI provider, storage persistence),
// and provides reactive subscriptions for the UI.

import type { ProviderAdapter } from "../providers/types.js";
import { EvaluationSchema, type Evaluation } from "../schemas/evaluation.schema.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";
import type { StorageAdapter } from "../storage/storage-interface.js";
import {
  createInitialInterviewState,
  interviewReducer,
  type ActiveQuestion,
  type CompletedTurn,
  type InterviewEffect,
  type InterviewEvent,
  type InterviewState,
} from "./state-machine.js";

export interface SessionRunnerOptions {
  plan: SessionPlan;
  questions: SelectedQuestion[];
  storage: StorageAdapter;
  provider?: ProviderAdapter | undefined;
  providerId?: string | undefined;
  modelId?: string | undefined;
  /** Auto-start the session upon creation (default: false) */
  autoStart?: boolean | undefined;
}

export type StateListener = (state: InterviewState) => void;

export class SessionRunner {
  private state: InterviewState;
  private listeners: Set<StateListener> = new Set();
  private storage: StorageAdapter;
  private provider?: ProviderAdapter | undefined;
  private providerId: string;
  private modelId: string;
  private isProcessing = false;
  private eventQueue: InterviewEvent[] = [];

  constructor(options: SessionRunnerOptions) {
    this.storage = options.storage;
    this.provider = options.provider;
    this.providerId = options.providerId ?? options.provider?.id ?? "mock-provider";
    this.modelId = options.modelId ?? "default-model";
    this.state = createInitialInterviewState(options.plan, options.questions);

    if (options.autoStart) {
      void this.dispatch({ type: "START" });
    }
  }

  public getState(): InterviewState {
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Error in interview state listener", err);
      }
    }
  }

  /**
   * Dispatches an event into the pure state machine, then executes any resulting effects.
   */
  public async dispatch(event: InterviewEvent): Promise<void> {
    this.eventQueue.push(event);
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      while (this.eventQueue.length > 0) {
        const currentEvent = this.eventQueue.shift()!;
        const { state: nextState, effects } = interviewReducer(this.state, currentEvent);
        this.state = nextState;
        this.notify();

        for (const effect of effects) {
          await this.executeEffect(effect);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeEffect(effect: InterviewEffect): Promise<void> {
    switch (effect.type) {
      case "PERSIST_SESSION": {
        await this.persistSession(effect.status, effect.endedAt);
        break;
      }

      case "PERSIST_TURN": {
        await this.persistTurn(effect.turn, effect.sessionId);
        break;
      }

      case "PREPARE_INTRO": {
        // In text mode, intro is immediate
        await this.dispatch({ type: "INTRO_DONE" });
        break;
      }

      case "LOAD_QUESTION": {
        const q = this.state.context.questions[effect.questionIndex];
        if (q) {
          const activeQ: ActiveQuestion = {
            id: q.id,
            text: q.text,
            difficulty: q.difficulty,
            skillTags: q.skillTags,
            isUnverified: q.isUnverified,
            followUpCount: 0,
            rubricHints: q.rubricHints,
            originalBankQuestion: q,
          };
          await this.dispatch({ type: "QUESTION_READY", question: activeQ });
        } else {
          await this.dispatch({
            type: "GEN_FAILED",
            error: { kind: "not_found", message: "Question could not be loaded." },
          });
        }
        break;
      }

      case "EVALUATE_TURN": {
        await this.evaluateTurn(effect.turn, effect.plan);
        break;
      }

      case "DECIDE_FOLLOW_UP": {
        await this.decideFollowUp(effect.lastTurn, effect.followUpCount, effect.plan);
        break;
      }

      case "GENERATE_HINT": {
        const hint = this.generateHint(effect.question);
        await this.dispatch({ type: "HINT_READY", hintText: hint });
        break;
      }

      case "PREPARE_WRAP_UP": {
        await this.dispatch({ type: "DONE" });
        break;
      }
    }
  }

  // --- Effect Helpers ------------------------------------------------------

  private async persistSession(
    status: "active" | "completed" | "abandoned",
    endedAt?: string
  ): Promise<void> {
    try {
      const plan = this.state.context.plan;
      const sessionRow: SessionRow = {
        id: plan.sessionId,
        startedAt: plan.createdAt,
        ...(endedAt ? { endedAt } : {}),
        status,
        plan,
        modality: plan.inputMode,
        level: plan.level,
        providerId: this.providerId,
        modelId: this.modelId,
        schemaVersion: 1,
      };
      await this.storage.put("sessions", sessionRow);
    } catch (err) {
      console.error("Failed to persist session", err);
    }
  }

  private async persistTurn(turn: CompletedTurn, sessionId: string): Promise<void> {
    try {
      const turnRow: TurnRow = {
        id: turn.id,
        sessionId,
        index: turn.index,
        ...(turn.questionId ? { questionId: turn.questionId } : {}),
        isUnverifiedQuestion: turn.isUnverifiedQuestion,
        skillTags: turn.skillTags,
        difficulty: turn.difficulty,
        questionText: turn.questionText,
        answerText: turn.answerText,
        ...(turn.followUpOf ? { followUpOf: turn.followUpOf } : {}),
        ...(turn.evaluation ? { evaluation: turn.evaluation } : {}),
        status: turn.status,
      };
      await this.storage.put("turns", turnRow);
    } catch (err) {
      console.error("Failed to persist turn", err);
    }
  }

  private async evaluateTurn(turn: CompletedTurn, plan: SessionPlan): Promise<void> {
    // If the answer is skipped or empty, no need to call AI
    if (turn.answerText === "[Skipped]" || turn.answerText === "[Time expired]") {
      const fallbackEvaluation: Evaluation = {
        criteria: {
          relevance: { score: 1, reason: "Answer was skipped", evidence: "Skipped" },
          structure: { score: 1, reason: "No response provided", evidence: "None" },
          depth: { score: 1, reason: "No technical details", evidence: "None" },
          clarity: { score: 1, reason: "No communication", evidence: "None" },
          levelFit: { score: 1, reason: "Unanswered", evidence: "None" },
        },
        skillScores: {},
        topFix: "Attempt to provide at least a brief summary of your approach.",
        unsupportedClaims: [],
      };
      await this.dispatch({ type: "SCORED", evaluation: fallbackEvaluation });
      return;
    }

    if (!this.provider) {
      // Deterministic evaluation fallback when running without an active provider
      const fallbackEvaluation = this.createFallbackEvaluation(turn, plan);
      await this.dispatch({ type: "SCORED", evaluation: fallbackEvaluation });
      return;
    }

    try {
      const controller = new AbortController();
      const prompt = `Evaluate candidate answer for role: ${plan.targetRole} (${plan.level}).
Question: "${turn.questionText}"
Candidate Answer: "${turn.answerText}"
Rate criteria 1-5 with short reason and verbatim evidence excerpt. Provide topFix and skillScores (0-100).`;

      const result = await this.provider.generateObject<Evaluation>(
        [
          {
            role: "system",
            content:
              "You are an objective engineering interview evaluator. Return valid evaluation JSON.",
          },
          { role: "user", content: prompt },
        ],
        EvaluationSchema,
        {
          signal: controller.signal,
          maxOutputTokens: 1000,
          temperature: 0,
        }
      );

      if (result.ok) {
        await this.dispatch({ type: "SCORED", evaluation: result.value });
      } else {
        await this.dispatch({
          type: "SCORE_FAILED",
          error: { kind: result.error.kind, message: result.error.message },
        });
      }
    } catch (err: unknown) {
      await this.dispatch({
        type: "SCORE_FAILED",
        error: {
          kind: "network",
          message: err instanceof Error ? err.message : "Provider call failed during evaluation.",
        },
      });
    }
  }

  private async decideFollowUp(
    lastTurn: CompletedTurn,
    followUpCount: number,
    plan: SessionPlan
  ): Promise<void> {
    // Only ask follow-up if count < 2 (FR-008 cap)
    const shouldProbe =
      followUpCount < 2 &&
      lastTurn.answerText !== "[Skipped]" &&
      lastTurn.answerText !== "[Time expired]" &&
      lastTurn.evaluation !== undefined &&
      (lastTurn.evaluation.criteria.depth.score <= 3 ||
        lastTurn.evaluation.criteria.clarity.score <= 3);

    if (shouldProbe && this.provider) {
      try {
        const controller = new AbortController();
        const followUpText = await this.generateFollowUpText(lastTurn, plan, controller.signal);
        if (followUpText) {
          const followUpQ: ActiveQuestion = {
            id: `followup-${lastTurn.id}`,
            text: followUpText,
            difficulty: lastTurn.difficulty,
            skillTags: lastTurn.skillTags,
            isUnverified: lastTurn.isUnverifiedQuestion,
            followUpCount: followUpCount + 1,
            parentQuestionId: lastTurn.questionId,
          };
          await this.dispatch({ type: "FOLLOW_UP", question: followUpQ });
          return;
        }
      } catch {
        // If follow-up generation fails, fall through to NEXT
      }
    }

    // Default: advance to next question
    await this.dispatch({ type: "NEXT" });
  }

  private async generateFollowUpText(
    lastTurn: CompletedTurn,
    plan: SessionPlan,
    signal: AbortSignal
  ): Promise<string | null> {
    if (!this.provider) return null;
    try {
      const response = await this.provider.stream(
        [
          {
            role: "system",
            content: `You are an interviewer conducting a ${plan.style} interview for a ${plan.level} ${plan.targetRole}.
Ask a focused, 1-sentence follow-up digging deeper into the candidate's last answer. Do not repeat the original question.`,
          },
          {
            role: "user",
            content: `Question: "${lastTurn.questionText}"\nAnswer: "${lastTurn.answerText}"\nAsk 1 concise follow-up question:`,
          },
        ],
        { signal, maxOutputTokens: 120 }
      );

      let text = "";
      for await (const chunk of response) {
        text += chunk.delta;
      }
      return text.trim().length > 10 ? text.trim() : null;
    } catch {
      return null;
    }
  }

  private generateHint(question: ActiveQuestion): string {
    const hints = question.rubricHints;
    if (hints && hints.length > 0) {
      return `Consider thinking about: ${hints[0]}`;
    }
    return `Focus your answer on the core technical trade-offs relevant to ${question.skillTags.join(", ")}.`;
  }

  private createFallbackEvaluation(turn: CompletedTurn, _plan: SessionPlan): Evaluation {
    const len = turn.answerText.length;
    const depthScore = len > 300 ? 4 : len > 100 ? 3 : 2;

    return {
      criteria: {
        relevance: {
          score: 3,
          reason: "Answer addresses topic",
          evidence: turn.answerText.slice(0, 50),
        },
        structure: {
          score: 3,
          reason: "Clear sequential phrasing",
          evidence: turn.answerText.slice(0, 50),
        },
        depth: {
          score: depthScore,
          reason: "Coverage of technical details",
          evidence: turn.answerText.slice(0, 50),
        },
        clarity: {
          score: 3,
          reason: "Understandable explanation",
          evidence: turn.answerText.slice(0, 50),
        },
        levelFit: {
          score: 3,
          reason: "Matches expected level",
          evidence: turn.answerText.slice(0, 50),
        },
      },
      skillScores: turn.skillTags.reduce((acc, tag) => ({ ...acc, [tag]: 70 }), {}),
      topFix: "Include more concrete examples and quantified impact in your response.",
      unsupportedClaims: [],
    };
  }
}
