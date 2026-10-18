// FR-023, AI-006, ADR-013, ADR-017: Post-load model sanity test runner and schemas.
import { z } from "zod";
import type { ProviderAdapter } from "../providers/types.js";
import type { ModelSanityStatus, SanityCheckStepResult, ModelSanityResult } from "./types.js";

export const ModelSanityStatusSchema = z.enum([
  "interview-ready",
  "questions-only",
  "not-suitable",
]);

export const SanityCheckStepResultSchema = z.object({
  passed: z.boolean(),
  latencyMs: z.number().nonnegative(),
  output: z.string().optional(),
  error: z.string().optional(),
});

export const ModelSanityResultSchema = z.object({
  status: ModelSanityStatusSchema,
  tokensPerSecond: z.number().nonnegative(),
  speedPassed: z.boolean(),
  jsonValid: z.boolean(),
  instructionFollowing: z.boolean(),
  testedAt: z.string(),
  modelId: z.string().optional(),
  referenceDevice: z.string().optional(),
  notes: z.string().optional(),
  stepResults: z
    .object({
      speed: SanityCheckStepResultSchema.optional(),
      instructionFollowing: SanityCheckStepResultSchema.optional(),
      jsonValidity: SanityCheckStepResultSchema.optional(),
    })
    .optional(),
});

export const CuratedModelSpeedSchema = z.object({
  referenceDevice: z.string().min(1),
  tokensPerSecond: z.number().positive(),
  latencyMs: z.number().nonnegative(),
});

export const CuratedModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  engine: z.literal("webllm"),
  repository: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  minimumTier: z.enum(["basic", "standard", "advanced"]),
  contextLength: z.number().int().min(2048),
  format: z.enum(["safetensors", "gguf", "onnx"]),
  measuredSpeed: CuratedModelSpeedSchema,
  sanityResult: ModelSanityResultSchema,
  notes: z.string().min(1),
});

export const CuratedCatalogSchema = z.object({
  version: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  updatedAt: z.string(),
  models: z.array(CuratedModelSchema).min(3).max(5),
});

export interface SanityTestThresholds {
  minInterviewTps: number;
  minQuestionsTps: number;
}

export const DEFAULT_SANITY_THRESHOLDS: SanityTestThresholds = {
  minInterviewTps: 10,
  minQuestionsTps: 4,
};

export interface SanityTestOptions {
  thresholds?: Partial<SanityTestThresholds>;
  deviceLabel?: string;
  signal?: AbortSignal;
  onStepChange?: (
    step: "speed" | "instructionFollowing" | "jsonValidity",
    status: "running" | "passed" | "failed"
  ) => void;
}

export const SANITY_PROMPTS = {
  speed:
    "You are a technical interviewer assistant. In two sentences, describe the key difference between an array and a linked list.",
  instructionFollowing:
    "Respond with the exact word 'READY' and absolutely nothing else. Do not add punctuation, quotes, or markdown.",
  jsonValidity:
    'Respond with a single raw JSON object formatted as {"ready": true, "role": "interviewer"}. Do not include markdown formatting or backticks.',
} as const;

/**
 * Extracts and cleans JSON candidate from model response.
 */
function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return trimmed;
}

/**
 * Runs the post-load model sanity test verifying speed, instruction following,
 * and JSON validity (FR-023, AI-006).
 */
export async function runModelSanityTest(
  provider: ProviderAdapter,
  modelId: string,
  options?: SanityTestOptions
): Promise<ModelSanityResult> {
  const thresholds: SanityTestThresholds = {
    ...DEFAULT_SANITY_THRESHOLDS,
    ...options?.thresholds,
  };

  const stepResults: {
    speed: SanityCheckStepResult;
    instructionFollowing: SanityCheckStepResult;
    jsonValidity: SanityCheckStepResult;
  } = {
    speed: { passed: false, latencyMs: 0 },
    instructionFollowing: { passed: false, latencyMs: 0 },
    jsonValidity: { passed: false, latencyMs: 0 },
  };

  let measuredTps = 0;

  const abortSignal = options?.signal ?? new AbortController().signal;

  // 1. Speed Test
  options?.onStepChange?.("speed", "running");
  const speedStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    let speedOutput = "";

    const stream = provider.stream([{ role: "user", content: SANITY_PROMPTS.speed }], {
      signal: abortSignal,
      maxOutputTokens: 120,
      temperature: 0.1,
    });

    for await (const chunk of stream) {
      if (chunk.delta) {
        speedOutput += chunk.delta;
      }
    }

    const speedEndTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsedMs = Math.max(1, speedEndTime - speedStartTime);
    const elapsedSeconds = elapsedMs / 1000;

    const words = speedOutput.trim().split(/\s+/).filter(Boolean);
    const tokenCount = Math.max(words.length, Math.round(speedOutput.length / 4));

    measuredTps = Math.round((tokenCount / elapsedSeconds) * 10) / 10;
    const speedPassed = measuredTps >= thresholds.minQuestionsTps;

    stepResults.speed = {
      passed: speedPassed,
      latencyMs: Math.round(elapsedMs),
      output: speedOutput.trim(),
    };
    options?.onStepChange?.("speed", speedPassed ? "passed" : "failed");
  } catch (err) {
    const elapsedMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - speedStartTime;
    stepResults.speed = {
      passed: false,
      latencyMs: Math.round(elapsedMs),
      error: err instanceof Error ? err.message : String(err),
    };
    options?.onStepChange?.("speed", "failed");
  }

  // 2. Instruction Following Test
  options?.onStepChange?.("instructionFollowing", "running");
  const instrStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    let instrOutput = "";
    const stream = provider.stream(
      [{ role: "user", content: SANITY_PROMPTS.instructionFollowing }],
      { signal: abortSignal, maxOutputTokens: 20, temperature: 0.0 }
    );

    for await (const chunk of stream) {
      if (chunk.delta) instrOutput += chunk.delta;
    }

    const instrEndTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const cleanOutput = instrOutput
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
    const passed = cleanOutput === "READY";

    stepResults.instructionFollowing = {
      passed,
      latencyMs: Math.round(instrEndTime - instrStartTime),
      output: instrOutput.trim(),
    };
    options?.onStepChange?.("instructionFollowing", passed ? "passed" : "failed");
  } catch (err) {
    const elapsedMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - instrStartTime;
    stepResults.instructionFollowing = {
      passed: false,
      latencyMs: Math.round(elapsedMs),
      error: err instanceof Error ? err.message : String(err),
    };
    options?.onStepChange?.("instructionFollowing", "failed");
  }

  // 3. JSON Validity Test
  options?.onStepChange?.("jsonValidity", "running");
  const jsonStartTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    let jsonOutput = "";
    const stream = provider.stream([{ role: "user", content: SANITY_PROMPTS.jsonValidity }], {
      signal: abortSignal,
      maxOutputTokens: 60,
      temperature: 0.0,
    });

    for await (const chunk of stream) {
      if (chunk.delta) jsonOutput += chunk.delta;
    }

    const jsonEndTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const cleaned = extractJsonCandidate(jsonOutput);
    let jsonPassed = false;

    try {
      const parsed = JSON.parse(cleaned) as { ready?: unknown; role?: unknown };
      if (parsed && parsed.ready === true && parsed.role === "interviewer") {
        jsonPassed = true;
      }
    } catch {
      jsonPassed = false;
    }

    stepResults.jsonValidity = {
      passed: jsonPassed,
      latencyMs: Math.round(jsonEndTime - jsonStartTime),
      output: jsonOutput.trim(),
    };
    options?.onStepChange?.("jsonValidity", jsonPassed ? "passed" : "failed");
  } catch (err) {
    const elapsedMs =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - jsonStartTime;
    stepResults.jsonValidity = {
      passed: false,
      latencyMs: Math.round(elapsedMs),
      error: err instanceof Error ? err.message : String(err),
    };
    options?.onStepChange?.("jsonValidity", "failed");
  }

  // Determine overall status
  let status: ModelSanityStatus = "not-suitable";
  const speedPassed = stepResults.speed.passed;
  const instructionFollowing = stepResults.instructionFollowing.passed;
  const jsonValid = stepResults.jsonValidity.passed;

  if (
    speedPassed &&
    measuredTps >= thresholds.minInterviewTps &&
    instructionFollowing &&
    jsonValid
  ) {
    status = "interview-ready";
  } else if (speedPassed && instructionFollowing) {
    status = "questions-only";
  } else {
    status = "not-suitable";
  }

  const notes =
    status === "interview-ready"
      ? `Interview ready: measured ${measuredTps} tps with verified JSON schema validity and instruction adherence.`
      : status === "questions-only"
        ? `Questions only: model followed instructions at ${measuredTps} tps, but JSON schema generation was unreliable or speed was below ${thresholds.minInterviewTps} tps.`
        : `Not suitable: model failed instruction following, failed speed threshold (${thresholds.minQuestionsTps} tps), or encountered an execution error.`;

  return {
    status,
    tokensPerSecond: measuredTps,
    speedPassed,
    jsonValid,
    instructionFollowing,
    testedAt: new Date().toISOString(),
    modelId,
    referenceDevice: options?.deviceLabel,
    notes,
    stepResults,
  };
}
