// FR-032, AI-024: Cost estimation, token usage tracking, and runaway loop caps.

export interface ModelPricing {
  modelId: string;
  label: string;
  promptPricePerMillionTokens: number; // in USD
  completionPricePerMillionTokens: number; // in USD
}

/**
 * Standard baseline pricing for popular models. Users can supply overrides.
 */
export const DEFAULT_MODEL_PRICING: readonly ModelPricing[] = [
  {
    modelId: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    promptPricePerMillionTokens: 0.075,
    completionPricePerMillionTokens: 0.3,
  },
  {
    modelId: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    promptPricePerMillionTokens: 1.25,
    completionPricePerMillionTokens: 5.0,
  },
  {
    modelId: "gpt-4o-mini",
    label: "GPT-4o mini",
    promptPricePerMillionTokens: 0.15,
    completionPricePerMillionTokens: 0.6,
  },
  {
    modelId: "gpt-4o",
    label: "GPT-4o",
    promptPricePerMillionTokens: 2.5,
    completionPricePerMillionTokens: 10.0,
  },
];

export interface SessionCostEstimate {
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  estimatedTotalTokens: number;
  estimatedCostMinUsd: number;
  estimatedCostMaxUsd: number;
}

/**
 * Estimates token usage and price range for a planned interview session.
 *
 * @param questionCount - Number of questions planned (typically 5, 10, or 15)
 * @param modelId - Chosen model ID
 * @param pricingList - Custom or default pricing table
 */
export function estimateSessionCost(
  questionCount: number,
  modelId: string,
  pricingList: readonly ModelPricing[] = DEFAULT_MODEL_PRICING
): SessionCostEstimate {
  // Average turns per question is ~1.5 (due to up to 2 follow-ups on some questions).
  const expectedTurns = Math.round(questionCount * 1.5);

  // Each turn sends condensed context (~800 - 1500 tokens).
  const promptTokensPerTurn = 1000;
  // Each completion is brief (~150 - 400 tokens).
  const completionTokensPerTurn = 250;

  const estimatedPromptTokens = expectedTurns * promptTokensPerTurn;
  const estimatedCompletionTokens = expectedTurns * completionTokensPerTurn;
  const estimatedTotalTokens = estimatedPromptTokens + estimatedCompletionTokens;

  const matched = pricingList.find(
    (p) =>
      p.modelId.toLowerCase() === modelId.toLowerCase() ||
      modelId.toLowerCase().includes(p.modelId.toLowerCase())
  );

  if (!matched) {
    // Custom/local/unknown provider: pricing unknown, returns 0 USD
    return {
      estimatedPromptTokens,
      estimatedCompletionTokens,
      estimatedTotalTokens,
      estimatedCostMinUsd: 0,
      estimatedCostMaxUsd: 0,
    };
  }

  const baseCost =
    (estimatedPromptTokens / 1_000_000) * matched.promptPricePerMillionTokens +
    (estimatedCompletionTokens / 1_000_000) * matched.completionPricePerMillionTokens;

  // Provide a conservative range (-20% to +30%)
  const minCost = Number((baseCost * 0.8).toFixed(4));
  const maxCost = Number((baseCost * 1.3).toFixed(4));

  return {
    estimatedPromptTokens,
    estimatedCompletionTokens,
    estimatedTotalTokens,
    estimatedCostMinUsd: minCost,
    estimatedCostMaxUsd: maxCost,
  };
}

export class RunawayLoopCapError extends Error {
  public readonly currentTokens: number;
  public readonly cap: number;

  constructor(currentTokens: number, cap: number) {
    super(
      `Session terminated: runaway loop protection reached token cap of ${cap} tokens (used: ${currentTokens}).`
    );
    this.name = "RunawayLoopCapError";
    this.currentTokens = currentTokens;
    this.cap = cap;
  }
}

export interface UsageCapConfig {
  /** Hard cap on total tokens consumed in a single session. Default: 50,000 */
  sessionTokenCap?: number;
  /** Hard cap on output tokens per single turn. Default: 1,000 */
  perTurnOutputCap?: number;
  /** Hard cap on total AI generation attempts per session. Default: 50 */
  maxTurnsCap?: number;
}

/**
 * Tracks token usage and terminates runaway loops before they exceed hard caps.
 */
export class UsageCapEnforcer {
  public readonly sessionTokenCap: number;
  public readonly perTurnOutputCap: number;
  public readonly maxTurnsCap: number;

  private _consumedTokens = 0;
  private _turnCount = 0;

  constructor(config: UsageCapConfig = {}) {
    this.sessionTokenCap = config.sessionTokenCap ?? 50_000;
    this.perTurnOutputCap = config.perTurnOutputCap ?? 1_000;
    this.maxTurnsCap = config.maxTurnsCap ?? 50;
  }

  get consumedTokens(): number {
    return this._consumedTokens;
  }

  get turnCount(): number {
    return this._turnCount;
  }

  isCapExceeded(): boolean {
    return this._consumedTokens >= this.sessionTokenCap || this._turnCount >= this.maxTurnsCap;
  }

  recordTurnUsage(tokens: number): void {
    this._turnCount += 1;
    this._consumedTokens += Math.max(0, tokens);

    if (this._consumedTokens > this.sessionTokenCap) {
      throw new RunawayLoopCapError(this._consumedTokens, this.sessionTokenCap);
    }
    if (this._turnCount > this.maxTurnsCap) {
      throw new RunawayLoopCapError(this._turnCount, this.maxTurnsCap);
    }
  }

  clampTurnTokens(requestedTokens: number): number {
    const remainingInSession = Math.max(0, this.sessionTokenCap - this._consumedTokens);
    return Math.min(requestedTokens, this.perTurnOutputCap, remainingInSession);
  }
}
