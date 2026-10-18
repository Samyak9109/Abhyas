// FR-008, FR-011, NFR-009, ADR-007: Session runner — effect executor and state coordinator.
// Manages the state machine, executes side-effects (AI provider, storage persistence),
// and provides reactive subscriptions for the UI.

import { calculateTurnScore, evaluateAnswer } from "../evaluation/rubric-evaluator.js";
import { buildLayeredInterviewContext, type TurnContextItem } from "./context-builder.js";
import type { ProviderAdapter } from "../providers/types.js";
import type { StructuredProfile } from "../schemas/profile.schema.js";
import type { RubricLevel } from "../schemas/rubric.schema.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";
import type { CompanyPack } from "../schemas/pack.schema.js";
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
  rubric?: RubricLevel | undefined;
  profile?: StructuredProfile | null | undefined;
  companyPack?: CompanyPack | null | undefined;
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
  private rubric?: RubricLevel | undefined;
  private profile?: StructuredProfile | null | undefined;
  private companyPack?: CompanyPack | null | undefined;
  private isProcessing = false;
  private eventQueue: InterviewEvent[] = [];

  constructor(options: SessionRunnerOptions) {
    this.storage = options.storage;
    this.provider = options.provider;
    this.providerId = options.providerId ?? options.provider?.id ?? "mock-provider";
    this.modelId = options.modelId ?? "default-model";
    this.rubric = options.rubric;
    this.profile = options.profile;
    this.companyPack = options.companyPack;
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

  private getEffectiveRubric(level: SessionPlan["level"]): RubricLevel {
    if (this.rubric) return this.rubric;
    return {
      level,
      description: `${level} engineering baseline expectations.`,
      axes: {
        depth: "Technical depth on architecture and operational trade-offs.",
        ambiguity: "Ability to handle ambiguity and state assumptions.",
        expectedScope: "Feature to system-level scope.",
        followUpPressure: "Follow-up probing on edge cases and failure modes.",
        behavioralExpectations: "Ownership, collaboration, and learning mindset.",
      },
      criteria: {
        relevance: {
          name: "Relevance & Directness",
          description: "Addresses prompt directly.",
          anchors: {
            "1": "Misses prompt completely.",
            "3": "Focuses directly on relevant trade-offs.",
            "5": "Pinpoints architectural tension immediately.",
          },
        },
        structure: {
          name: "Structural Framing",
          description: "Uses STAR and clear logical flow.",
          anchors: {
            "1": "Ad-hoc design.",
            "3": "Well-organized presentation.",
            "5": "Masterful systematic presentation.",
          },
        },
        depth: {
          name: "Technical & Conceptual Depth",
          description: "Understands operational failure modes.",
          anchors: {
            "1": "Superficial knowledge.",
            "3": "Solid depth on mechanisms and complexity.",
            "5": "Impressive depth on edge cases.",
          },
        },
        clarity: {
          name: "Clarity & Articulation",
          description: "Balances technical depth with succinct clarity.",
          anchors: {
            "1": "Rambling answers.",
            "3": "Speaks with clarity and good pacing.",
            "5": "Highly articulate and engaging delivery.",
          },
        },
        levelFit: {
          name: "Level Alignment",
          description: "Calibrated against level expectations.",
          anchors: {
            "1": "Below expected baseline.",
            "3": "Meets level expectations comfortably.",
            "5": "Exhibits instincts above current level.",
          },
        },
      },
    };
  }

  private async evaluateTurn(turn: CompletedTurn, plan: SessionPlan): Promise<void> {
    const rubric = this.getEffectiveRubric(plan.level);
    const isSmallModel =
      this.provider?.id === "webllm" || Boolean((plan as { isSmallModel?: boolean }).isSmallModel);

    const outcome = await evaluateAnswer({
      question: {
        text: turn.questionText,
        skillTags: turn.skillTags,
        difficulty: turn.difficulty,
      },
      answerText: turn.answerText,
      level: plan.level,
      targetRole: plan.targetRole,
      rubric,
      profile: this.profile,
      provider: this.provider,
      companyValues: this.companyPack?.values?.value
        ? this.companyPack.values.value.map((v) => `${v.name}: ${v.description}`)
        : undefined,
      isSmallModel,
    });

    if (outcome.status === "scored") {
      await this.dispatch({ type: "SCORED", evaluation: outcome.evaluation });
    } else {
      await this.dispatch({
        type: "SCORE_FAILED",
        error: { kind: "network", message: outcome.error },
      });
    }
  }

  private async decideFollowUp(
    lastTurn: CompletedTurn,
    followUpCount: number,
    plan: SessionPlan
  ): Promise<void> {
    // In quick-fire drill format, do not ask follow-ups (short rapid answers per FR-016)
    if (plan.drillFormat === "quick_fire") {
      await this.dispatch({ type: "NEXT" });
      return;
    }

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
          if (plan.inputMode === "text") {
            await this.dispatch({ type: "QUESTION_READY", question: followUpQ });
          }
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
      const isSmall =
        this.provider.id === "webllm" || Boolean((plan as { isSmallModel?: boolean }).isSmallModel);

      const completedTurnItems: TurnContextItem[] = this.state.context.turns.map((t, idx) => ({
        index: idx,
        questionText: t.questionText,
        answerText: t.answerText,
        skillTags: t.skillTags,
        score: t.evaluation ? calculateTurnScore(t.evaluation) : undefined,
        evaluationTopFix: t.evaluation?.topFix,
      }));

      // AI-013 & AI-014: Build structured 7-layer context with rolling summary & token budget
      const context = buildLayeredInterviewContext({
        targetRole: plan.targetRole,
        level: plan.level,
        interviewStyle: plan.style,
        profile: this.profile,
        companyPack: this.companyPack,
        completedTurns: completedTurnItems,
        currentQuestion: lastTurn.questionText,
        instruction:
          "Ask a focused, 1-sentence follow-up digging deeper into the candidate's last answer. Do not repeat the original question.",
        isSmallModel: isSmall,
        targetTokenBudget: isSmall ? 3000 : 8000,
      });

      const response = await this.provider.stream(context.messages, {
        signal,
        maxOutputTokens: 120,
      });

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
}
