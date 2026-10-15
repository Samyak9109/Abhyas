// FR-032, AI-024: Cost estimation and usage cap tests.
import { describe, expect, it } from "vitest";
import { estimateSessionCost, RunawayLoopCapError, UsageCapEnforcer } from "./cost-estimator";

describe("Cost Estimator and Usage Caps (FR-032)", () => {
  it("calculates cost estimate and token range for known models", () => {
    const estimate = estimateSessionCost(10, "gemini-1.5-flash");

    expect(estimate.estimatedTotalTokens).toBeGreaterThan(0);
    expect(estimate.estimatedPromptTokens).toBe(15_000); // 15 turns * 1000
    expect(estimate.estimatedCompletionTokens).toBe(3_750); // 15 turns * 250
    expect(estimate.estimatedCostMinUsd).toBeGreaterThan(0);
    expect(estimate.estimatedCostMaxUsd).toBeGreaterThanOrEqual(estimate.estimatedCostMinUsd);
  });

  it("handles unknown or local models by returning 0 USD cost estimate", () => {
    const estimate = estimateSessionCost(10, "llama-3-custom");

    expect(estimate.estimatedTotalTokens).toBeGreaterThan(0);
    expect(estimate.estimatedCostMinUsd).toBe(0);
    expect(estimate.estimatedCostMaxUsd).toBe(0);
  });

  it("enforces per-turn output caps and tracks token usage", () => {
    const enforcer = new UsageCapEnforcer({
      sessionTokenCap: 10_000,
      perTurnOutputCap: 800,
      maxTurnsCap: 20,
    });

    expect(enforcer.clampTurnTokens(1200)).toBe(800);
    enforcer.recordTurnUsage(800);
    expect(enforcer.consumedTokens).toBe(800);
    expect(enforcer.turnCount).toBe(1);
    expect(enforcer.isCapExceeded()).toBe(false);
  });

  it("halts runaway loop when session token cap is exceeded", () => {
    const enforcer = new UsageCapEnforcer({
      sessionTokenCap: 2000,
      maxTurnsCap: 10,
    });

    enforcer.recordTurnUsage(1000);
    enforcer.recordTurnUsage(800);
    expect(enforcer.isCapExceeded()).toBe(false);

    // Exceeding 2000 tokens should throw RunawayLoopCapError
    expect(() => enforcer.recordTurnUsage(500)).toThrow(RunawayLoopCapError);
    expect(enforcer.isCapExceeded()).toBe(true);
  });

  it("halts runaway loop when turn count cap is exceeded", () => {
    const enforcer = new UsageCapEnforcer({
      sessionTokenCap: 50_000,
      maxTurnsCap: 3,
    });

    enforcer.recordTurnUsage(10);
    enforcer.recordTurnUsage(10);
    expect(enforcer.isCapExceeded()).toBe(false);

    enforcer.recordTurnUsage(10);
    expect(enforcer.isCapExceeded()).toBe(true);

    // 4th turn exceeds maxTurnsCap 3
    expect(() => enforcer.recordTurnUsage(10)).toThrow(RunawayLoopCapError);
    expect(enforcer.isCapExceeded()).toBe(true);
  });
});
