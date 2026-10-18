// FR-022, FR-023, ADR-013, NFR-023: Unit tests for in-browser local engine provider adapter.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LocalEngineAdapter, type EngineWorkerBridge } from "./local-engine-adapter.js";
import type { LocalWorkerRequest, LocalWorkerResponse } from "./types.js";

function createMockBridge() {
  let messageHandler: ((event: LocalWorkerResponse) => void) | null = null;
  const sentRequests: LocalWorkerRequest[] = [];

  const bridge: EngineWorkerBridge = {
    postMessage: vi.fn((req: LocalWorkerRequest) => {
      sentRequests.push(req);
    }),
    onMessage: vi.fn((handler: (event: LocalWorkerResponse) => void) => {
      messageHandler = handler;
      return () => {
        messageHandler = null;
      };
    }),
  };

  const emit = (res: LocalWorkerResponse) => {
    if (messageHandler) {
      messageHandler(res);
    }
  };

  return { bridge, sentRequests, emit };
}

describe("LocalEngineAdapter (FR-022, FR-023, ADR-013)", () => {
  it("exposes capabilities with streaming and prompted json mode", async () => {
    const adapter = new LocalEngineAdapter();
    const caps = await adapter.capabilities();
    expect(caps.streaming).toBe(true);
    expect(caps.jsonMode).toBe("prompted");
    expect(caps.maxContextTokens).toBe(2048);
  });

  it("lists curated and installed models", async () => {
    const adapter = new LocalEngineAdapter();
    const res = await adapter.listModels();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value[0]?.id).toContain("SmolLM2");
    }
  });

  it("fails testConnection when no model is loaded", async () => {
    const { bridge } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });
    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("model_not_found");
      expect(res.error.message).toContain("No local model is currently loaded");
    }
  });

  it("loads a model, reports progress, and succeeds", async () => {
    const { bridge, emit, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });
    const progressList: number[] = [];

    const loadPromise = adapter.loadModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC", (p) => {
      progressList.push(p.percentage);
    });

    const req = sentRequests.find((r) => r.type === "LOAD_MODEL");
    expect(req).toBeDefined();

    emit({
      type: "PROGRESS",
      id: req!.id,
      progress: {
        phase: "downloading",
        bytesLoaded: 500_000,
        totalBytes: 1_000_000,
        percentage: 50,
        text: "Downloading weights...",
        modelId: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      },
    });

    emit({
      type: "SUCCESS",
      id: req!.id,
    });

    const res = await loadPromise;
    expect(res.ok).toBe(true);
    expect(progressList).toEqual([50]);
    expect(adapter.isModelLoaded()).toBe(true);
    expect(adapter.getCurrentModelId()).toBe("SmolLM2-1.7B-Instruct-q4f16_1-MLC");

    // testConnection should now succeed
    const connRes = await adapter.testConnection();
    expect(connRes.ok).toBe(true);
  });

  it("handles model load error from worker", async () => {
    const { bridge, emit, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    const loadPromise = adapter.loadModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    const req = sentRequests.find((r) => r.type === "LOAD_MODEL");

    emit({
      type: "ERROR",
      id: req!.id,
      error: {
        kind: "network",
        message: "Failed to download model weights",
        retryable: true,
      },
    });

    const res = await loadPromise;
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("network");
      expect(res.error.message).toContain("Failed to download model weights");
    }
    expect(adapter.isModelLoaded()).toBe(false);
  });

  it("unloads model and frees memory", async () => {
    const { bridge, emit, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    const loadPromise = adapter.loadModel("test-model");
    const loadReq = sentRequests.find((r) => r.type === "LOAD_MODEL");
    emit({ type: "SUCCESS", id: loadReq!.id });
    await loadPromise;
    expect(adapter.isModelLoaded()).toBe(true);

    const unloadRes = await adapter.unloadModel();
    expect(unloadRes.ok).toBe(true);
    expect(adapter.isModelLoaded()).toBe(false);
    expect(adapter.getCurrentModelId()).toBeUndefined();
    expect(sentRequests.some((r) => r.type === "UNLOAD_MODEL")).toBe(true);
  });

  it("pauses and resumes model download", async () => {
    const { bridge, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    await adapter.pauseDownload("test-model");
    expect(sentRequests.some((r) => r.type === "PAUSE_DOWNLOAD")).toBe(true);

    await adapter.resumeDownload("test-model");
    expect(sentRequests.some((r) => r.type === "RESUME_DOWNLOAD")).toBe(true);
  });

  it("deletes cached model", async () => {
    const { bridge, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    await adapter.deleteModel("test-model");
    expect(sentRequests.some((r) => r.type === "DELETE_CACHE")).toBe(true);
  });

  it("streams tokens from loaded model", async () => {
    const { bridge, emit, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    // Pre-load model
    const loadPromise = adapter.loadModel("test-model");
    const loadReq = sentRequests.find((r) => r.type === "LOAD_MODEL");
    emit({ type: "SUCCESS", id: loadReq!.id });
    await loadPromise;

    const abortController = new AbortController();
    const chunks: string[] = [];

    const streamPromise = (async () => {
      for await (const chunk of adapter.stream(
        [{ role: "user", content: "Tell me about yourself" }],
        { signal: abortController.signal, maxOutputTokens: 100 }
      )) {
        chunks.push(chunk.delta);
      }
    })();

    const streamReq = sentRequests.find((r) => r.type === "STREAM_CHAT");
    expect(streamReq).toBeDefined();

    emit({ type: "STREAM_CHUNK", id: streamReq!.id, delta: "I am ", isComplete: false });
    emit({ type: "STREAM_CHUNK", id: streamReq!.id, delta: "ready.", isComplete: true });
    emit({ type: "STREAM_DONE", id: streamReq!.id });

    await streamPromise;
    expect(chunks).toEqual(["I am ", "ready."]);
  });

  it("generates and parses schema-validated object", async () => {
    const { bridge, emit, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    const loadPromise = adapter.loadModel("test-model");
    const loadReq = sentRequests.find((r) => r.type === "LOAD_MODEL");
    emit({ type: "SUCCESS", id: loadReq!.id });
    await loadPromise;

    const TestSchema = z.object({
      feedback: z.string(),
      score: z.number(),
    });

    const genPromise = adapter.generateObject([{ role: "user", content: "Evaluate" }], TestSchema, {
      signal: new AbortController().signal,
      maxOutputTokens: 200,
    });

    const streamReq = sentRequests.find(
      (r) => r.type === "STREAM_CHAT" && (r.messages as unknown[])[0] !== undefined
    );
    expect(streamReq).toBeDefined();

    emit({
      type: "STREAM_CHUNK",
      id: streamReq!.id,
      delta: '{"feedback": "Good answer", "score": 4}',
      isComplete: true,
    });
    emit({ type: "STREAM_DONE", id: streamReq!.id });

    const res = await genPromise;
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.feedback).toBe("Good answer");
      expect(res.value.score).toBe(4);
    }
  });

  it("handles cancellation in stream when aborted", async () => {
    const { bridge, emit, sentRequests } = createMockBridge();
    const adapter = new LocalEngineAdapter({ bridge });

    const loadPromise = adapter.loadModel("test-model");
    const loadReq = sentRequests.find((r) => r.type === "LOAD_MODEL");
    emit({ type: "SUCCESS", id: loadReq!.id });
    await loadPromise;

    const abortController = new AbortController();

    const streamPromise = (async () => {
      for await (const _chunk of adapter.stream([{ role: "user", content: "Cancel test" }], {
        signal: abortController.signal,
        maxOutputTokens: 100,
      })) {
        // should receive nothing or abort
      }
    })();

    abortController.abort();
    await expect(streamPromise).rejects.toThrow("aborted");
    expect(sentRequests.some((r) => r.type === "CANCEL")).toBe(true);
  });
});
