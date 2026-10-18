// FR-023, AI-006, ADR-013, ADR-017: Unit tests for model sanity test runner and schemas.
import { describe, it, expect } from "vitest";
import type {
  ProviderAdapter,
  ChatMessage,
  GenerateOptions,
  StreamChunk,
} from "../providers/types.js";
import {
  runModelSanityTest,
  ModelSanityResultSchema,
  CuratedModelSchema,
  CuratedCatalogSchema,
} from "./sanity.js";

function createTestProvider(
  responder: (prompt: string) => AsyncIterable<StreamChunk>
): ProviderAdapter {
  return {
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
      const last = messages[messages.length - 1]?.content ?? "";
      return responder(last);
    },
    generateObject: async () => {
      throw new Error("Not implemented in test provider");
    },
  };
}

describe("runModelSanityTest (FR-023, AI-006)", () => {
  it("classifies an optimal model as interview-ready", async () => {
    const provider = createTestProvider(async function* (prompt) {
      if (prompt.includes("array and a linked list")) {
        yield {
          delta: "An array stores elements consecutively in contiguous memory. ",
          isComplete: false,
        };
        yield {
          delta: "A linked list connects disparate nodes using memory pointers.",
          isComplete: true,
        };
      } else if (prompt.includes("exact word 'READY'")) {
        yield { delta: "READY", isComplete: true };
      } else if (prompt.includes("raw JSON object")) {
        yield { delta: '{"ready": true, "role": "interviewer"}', isComplete: true };
      } else {
        yield { delta: "ok", isComplete: true };
      }
    });

    const stepEvents: string[] = [];
    const result = await runModelSanityTest(provider, "test-model-1", {
      thresholds: { minInterviewTps: 1, minQuestionsTps: 0.5 },
      deviceLabel: "Mock Reference GPU",
      onStepChange: (step, status) => {
        stepEvents.push(`${step}:${status}`);
      },
    });

    expect(result.status).toBe("interview-ready");
    expect(result.speedPassed).toBe(true);
    expect(result.instructionFollowing).toBe(true);
    expect(result.jsonValid).toBe(true);
    expect(result.referenceDevice).toBe("Mock Reference GPU");
    expect(result.notes).toContain("Interview ready");
    expect(stepEvents).toContain("speed:running");
    expect(stepEvents).toContain("speed:passed");
    expect(stepEvents).toContain("instructionFollowing:passed");
    expect(stepEvents).toContain("jsonValidity:passed");

    // Must validate with ModelSanityResultSchema
    const parseRes = ModelSanityResultSchema.safeParse(result);
    expect(parseRes.success).toBe(true);
  });

  it("classifies a model that fails JSON as questions-only", async () => {
    const provider = createTestProvider(async function* (prompt) {
      if (prompt.includes("array and a linked list")) {
        yield {
          delta: "Arrays are contiguous and fast to index. Linked lists have dynamic sizing.",
          isComplete: true,
        };
      } else if (prompt.includes("exact word 'READY'")) {
        yield { delta: "READY", isComplete: true };
      } else if (prompt.includes("raw JSON object")) {
        // Model outputs conversational text instead of valid JSON
        yield { delta: "I am ready to be an interviewer now!", isComplete: true };
      }
    });

    const result = await runModelSanityTest(provider, "test-model-2", {
      thresholds: { minInterviewTps: 1, minQuestionsTps: 0.5 },
    });

    expect(result.status).toBe("questions-only");
    expect(result.speedPassed).toBe(true);
    expect(result.instructionFollowing).toBe(true);
    expect(result.jsonValid).toBe(false);
    expect(result.notes).toContain("Questions only");
  });

  it("classifies a model that fails instruction following as not-suitable", async () => {
    const provider = createTestProvider(async function* (prompt) {
      if (prompt.includes("array and a linked list")) {
        yield { delta: "Arrays are contiguous blocks. Linked lists use nodes.", isComplete: true };
      } else if (prompt.includes("exact word 'READY'")) {
        // Model does not follow strict instruction
        yield { delta: "Sure! Here is the answer you requested: I am ready.", isComplete: true };
      } else if (prompt.includes("raw JSON object")) {
        yield { delta: '{"ready": true, "role": "interviewer"}', isComplete: true };
      }
    });

    const result = await runModelSanityTest(provider, "test-model-3", {
      thresholds: { minInterviewTps: 1, minQuestionsTps: 0.5 },
    });

    expect(result.status).toBe("not-suitable");
    expect(result.instructionFollowing).toBe(false);
    expect(result.notes).toContain("Not suitable");
  });

  it("handles provider stream errors gracefully without crashing", async () => {
    const provider = createTestProvider(async function* () {
      yield { delta: "", isComplete: false };
      throw new Error("WebGPU device lost in worker");
    });

    const result = await runModelSanityTest(provider, "failing-model");

    expect(result.status).toBe("not-suitable");
    expect(result.speedPassed).toBe(false);
    expect(result.stepResults?.speed?.error).toContain("WebGPU device lost in worker");
  });

  it("accepts JSON wrapped in markdown codeblocks", async () => {
    const provider = createTestProvider(async function* (prompt) {
      if (prompt.includes("raw JSON object")) {
        yield { delta: '```json\n{"ready": true, "role": "interviewer"}\n```', isComplete: true };
      } else if (prompt.includes("READY")) {
        yield { delta: "READY", isComplete: true };
      } else {
        yield { delta: "Contiguous arrays vs pointer linked nodes in memory.", isComplete: true };
      }
    });

    const result = await runModelSanityTest(provider, "wrapped-json-model", {
      thresholds: { minInterviewTps: 1, minQuestionsTps: 0.5 },
    });

    expect(result.jsonValid).toBe(true);
    expect(result.status).toBe("interview-ready");
  });
});

describe("CuratedModel & Catalog Schemas (FR-023)", () => {
  it("validates a complete curated model object", () => {
    const validModel = {
      id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      name: "SmolLM2 1.7B Instruct",
      engine: "webllm",
      repository: "HuggingFaceTB/SmolLM2-1.7B-Instruct",
      sizeBytes: 1050000000,
      minimumTier: "basic",
      contextLength: 2048,
      format: "safetensors",
      measuredSpeed: {
        referenceDevice: "Apple M2 / RTX 3060",
        tokensPerSecond: 28.5,
        latencyMs: 120,
      },
      sanityResult: {
        status: "interview-ready",
        tokensPerSecond: 28.5,
        speedPassed: true,
        jsonValid: true,
        instructionFollowing: true,
        testedAt: "2026-10-18T00:00:00.000Z",
        referenceDevice: "Apple M2",
      },
      notes: "Compact and fast.",
    };

    const parsed = CuratedModelSchema.safeParse(validModel);
    expect(parsed.success).toBe(true);
  });

  it("rejects catalog with fewer than 3 models", () => {
    const catalog = {
      version: 1,
      schemaVersion: 1,
      updatedAt: "2026-10-18T00:00:00.000Z",
      models: [
        {
          id: "model-1",
          name: "Model 1",
          engine: "webllm",
          repository: "repo/1",
          sizeBytes: 1000,
          minimumTier: "basic",
          contextLength: 2048,
          format: "safetensors",
          measuredSpeed: { referenceDevice: "dev", tokensPerSecond: 20, latencyMs: 50 },
          sanityResult: {
            status: "interview-ready",
            tokensPerSecond: 20,
            speedPassed: true,
            jsonValid: true,
            instructionFollowing: true,
            testedAt: "2026-10-18T00:00:00.000Z",
          },
          notes: "note",
        },
      ],
    };

    const parsed = CuratedCatalogSchema.safeParse(catalog);
    expect(parsed.success).toBe(false);
  });
});
