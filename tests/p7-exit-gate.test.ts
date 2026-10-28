// Phase 7 Exit Gate Verification (phases.md Section 3 & 7, FR-005, FR-009, FR-010, FR-021, FR-023, AI-006, AI-025, ADR-002, ADR-005, ADR-014, ADR-017)
// Verifies:
// 1. Claude & Hugging Face BYOK Adapters with direct browser access and network allowlist isolation (M7.1)
// 2. Custom Local Models across WebLLM & Ollama with format safety pre-flight and sanity test harness (M7.2)
// 3. On-Device Speech Recognition & Automatic VAD Hands-Free Silence Detection with zero cloud egress (M7.3)
// 4. Calibrated Question Bank (12 questions/level, 60 total) & Golden Evaluation Suite MAS <= 0.5 (Tracks 4.1 & 4.2)

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  AnthropicAdapter,
  HuggingFaceAdapter,
  isAllowedDestination,
  validateCustomModel,
  estimateHardwareFit,
  runModelSanityTest,
  VadEngine,
  calculateRms,
  rmsToMeterLevel,
  VoiceSettingsSchema,
  evaluateAnswer,
  generateGroundedRewrite,
  validateGrounding,
  ANTHROPIC_FIXTURES,
  type StructuredProfile,
  type ExperienceLevel,
  type ProviderAdapter,
  QuestionBankSchema,
} from "@abhyas/core";
import { SAMPLE_QUESTION_BANK, CANONICAL_SKILL_IDS, CANONICAL_RUBRICS } from "@abhyas/content";

describe("Phase 7 Exit Gate Verification (phases.md Section 3 & 7)", () => {
  describe("1. Claude & Hugging Face Adapters & Key Safety (M7.1, FR-005, NFR-005, ADR-002, ADR-005)", () => {
    it("AnthropicAdapter dispatches messages API with browser header and parses streaming chunks", async () => {
      let capturedUrl = "";
      let capturedHeaders: HeadersInit | undefined;
      const fakeFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedHeaders = init?.headers;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            for (const chunk of ANTHROPIC_FIXTURES.streamSseChunks) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      });

      const adapter = new AnthropicAdapter({
        apiKey: "sk-ant-test-key-12345",
        model: "claude-3-5-sonnet-20241022",
        fetchFn: fakeFetch,
      });

      const chunks: string[] = [];
      for await (const chunk of adapter.stream([{ role: "user", content: "Hello" }], {
        signal: new AbortController().signal,
        maxOutputTokens: 100,
      })) {
        if (chunk.delta) {
          chunks.push(chunk.delta);
        }
      }

      expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
      const headersObj = capturedHeaders as Record<string, string>;
      expect(headersObj["anthropic-dangerous-direct-browser-access"]).toBe("true");
      expect(headersObj["x-api-key"]).toBe("sk-ant-test-key-12345");
      expect(chunks.join("")).toBe("Good morning. Let's begin.");
    });

    it("HuggingFaceAdapter sends OpenAI-compatible chat requests and token auth", async () => {
      const fakeFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string>;
        expect(url).toBe("https://api-inference.huggingface.co/v1/chat/completions");
        expect(headers["Authorization"]).toBe("Bearer hf_test_token_abc");
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    enabled: true,
                    mode: "speech_and_text",
                    speechEngine: "on-device",
                    vadEnabled: true,
                    silenceTimeoutMs: 1800,
                  }),
                },
              },
            ],
            usage: { total_tokens: 25 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const adapter = new HuggingFaceAdapter({
        apiKey: "hf_test_token_abc",
        model: "meta-llama/Llama-3.2-3B-Instruct",
        fetchFn: fakeFetch,
      });

      const res = await adapter.generateObject(
        [{ role: "user", content: "Test prompt" }],
        VoiceSettingsSchema,
        { signal: new AbortController().signal, maxOutputTokens: 100 }
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.speechEngine).toBe("on-device");
      }
    });

    it("Network allowlist strictly permits Anthropic & Hugging Face while blocking unapproved hosts", () => {
      expect(isAllowedDestination("https://api.anthropic.com/v1/messages")).toBe(true);
      expect(isAllowedDestination("https://api-inference.huggingface.co/v1/chat/completions")).toBe(
        true
      );
      expect(isAllowedDestination("https://router.huggingface.co/v1/chat/completions")).toBe(true);

      // Blocked destinations
      expect(isAllowedDestination("https://evil-hacker.com/steal")).toBe(false);
      expect(isAllowedDestination("https://telemetry.segment.io/v1/track")).toBe(false);
      expect(isAllowedDestination("https://analytics.google.com/collect")).toBe(false);
    });

    it("Redacts API keys and tokens completely from classified errors", async () => {
      const secretKey = "sk-ant-sensitive-secret-token-xyz";
      const failingFetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              type: "authentication_error",
              message: `Invalid key provided: ${secretKey}`,
            },
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      });

      const adapter = new AnthropicAdapter({
        apiKey: secretKey,
        model: "claude-3-5-sonnet-20241022",
        fetchFn: failingFetch,
      });

      const res = await adapter.generateObject(
        [{ role: "user", content: "Hi" }],
        VoiceSettingsSchema,
        { signal: new AbortController().signal, maxOutputTokens: 100 }
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message.includes(secretKey)).toBe(false);
        expect(res.error.kind).toBe("auth");
      }
    });
  });

  describe("2. Custom Local Models & Sanity Harness (M7.2, FR-023, AI-006, ADR-017)", () => {
    it("Format validator allows safe formats (.safetensors, .gguf, .onnx) and blocks pickle formats (.pkl, .bin, .pt, .pth)", () => {
      // Allowed formats
      expect(validateCustomModel("llama-3-8b.safetensors", "webllm").valid).toBe(true);
      expect(validateCustomModel("mistral-7b-instruct-v0.2.Q4_K_M.gguf", "webllm").valid).toBe(
        true
      );
      expect(validateCustomModel("model.onnx", "webllm").valid).toBe(true);

      // Disallowed dangerous pickle formats
      const pklCheck = validateCustomModel("pytorch_model.bin", "webllm");
      expect(pklCheck.valid).toBe(false);
      expect(pklCheck.error).toContain("pickle-based");

      const ptCheck = validateCustomModel("weights.pt", "webllm");
      expect(ptCheck.valid).toBe(false);

      const pthCheck = validateCustomModel("model.pth", "webllm");
      expect(pthCheck.valid).toBe(false);

      const pklRaw = validateCustomModel("payload.pkl", "webllm");
      expect(pklRaw.valid).toBe(false);
    });

    it("Ollama engine validates tags and rejects whitespace/invalid characters", () => {
      expect(validateCustomModel("llama3.2:3b", "ollama").valid).toBe(true);
      expect(validateCustomModel("deepseek-coder:6.7b-instruct-q4_K_M", "ollama").valid).toBe(true);
      expect(validateCustomModel("llama3 8b", "ollama").valid).toBe(false);
      expect(validateCustomModel("llama3;rm -rf /", "ollama").valid).toBe(false);
    });

    it("Calculates hardware fit estimates and suitability verdicts accurately", () => {
      // 2 GB weights on 16 GB RAM -> optimal
      const fit1 = estimateHardwareFit(2 * 1024 * 1024 * 1024, 16);
      expect(fit1.fit).toBe("optimal");
      expect(fit1.message).toContain("Optimal fit");

      // 4 GB weights on 8 GB RAM (5 GB footprint) -> tight
      const fit2 = estimateHardwareFit(4 * 1024 * 1024 * 1024, 8);
      expect(fit2.fit).toBe("tight");
      expect(fit2.message).toContain("Tight fit");

      // 20 GB weights on 8 GB RAM -> insufficient
      const fit3 = estimateHardwareFit(20 * 1024 * 1024 * 1024, 8);
      expect(fit3.fit).toBe("insufficient");
      expect(fit3.message).toContain("High memory demand");
    });

    it("Sanity test harness evaluates speed, READY prompt instruction following, and JSON validity", async () => {
      const mockAdapter: ProviderAdapter = {
        id: "ollama",
        capabilities: async () => ({ streaming: true, jsonMode: "prompted" }),
        listModels: async () => ({
          ok: true,
          value: [{ id: "custom-test", label: "Custom Test" }],
        }),
        testConnection: async () => ({ ok: true, value: undefined }),
        async *stream(messages) {
          const userPrompt = messages[messages.length - 1]?.content ?? "";
          if (userPrompt.includes("READY")) {
            yield { type: "delta", delta: "READY" };
            yield { type: "done" };
          } else if (userPrompt.includes("single raw JSON object")) {
            yield { type: "delta", delta: '{"ready": true, "role": "interviewer"}' };
            yield { type: "done" };
          } else {
            yield {
              type: "delta",
              delta: "Arrays have fixed contiguous memory while linked lists use node pointers.",
            };
            yield { type: "done" };
          }
        },
        async generateObject() {
          return { ok: true, value: {} as never };
        },
      };

      const result = await runModelSanityTest(mockAdapter, "custom-test");
      expect(result.status).toBe("interview-ready");
      expect(result.speedPassed).toBe(true);
      expect(result.instructionFollowing).toBe(true);
      expect(result.jsonValid).toBe(true);
      expect(result.tokensPerSecond).toBeGreaterThanOrEqual(10);
    });
  });

  describe("3. On-Device Speech Recognition & Automatic VAD (M7.3, FR-009, FR-010, FR-021, ADR-014)", () => {
    it("Calculates RMS audio energy and maps to normalized meter level", () => {
      expect(calculateRms([])).toBe(0);
      const samples = new Float32Array([0.1, -0.1, 0.1, -0.1]);
      const rms = calculateRms(samples);
      expect(rms).toBeCloseTo(0.1, 3);

      const meterLevel = rmsToMeterLevel(rms, 5);
      expect(meterLevel).toBeCloseTo(0.5, 2);
    });

    it("VAD transitions from listening -> speaking -> silence countdown -> speech end", () => {
      let speechStarted = false;
      let speechEnded = false;
      let countdownCalled = false;

      const vad = new VadEngine({
        speechThreshold: 0.05,
        speechMinFrames: 2,
        silenceTimeoutMs: 500,
        minSpeechDurationMs: 100,
        onSpeechStart: () => {
          speechStarted = true;
        },
        onSpeechEnd: () => {
          speechEnded = true;
        },
        onSilenceCountdown: () => {
          countdownCalled = true;
        },
      });

      vad.startListening();
      expect(vad.getState()).toBe("listening");

      const loud = new Float32Array([0.2, 0.2, 0.2]);
      const quiet = new Float32Array([0.001, 0.001]);

      // Frame 1 at t=1000: loud sample
      vad.processFrame(loud, 1000);
      // Frame 2 at t=1050: loud sample (meets speechMinFrames = 2, enters speaking)
      vad.processFrame(loud, 1050);
      expect(speechStarted).toBe(true);
      expect(vad.getState()).toBe("speaking");

      // Frame 3 at t=1200: continues speaking (exceeds minSpeechDurationMs of 100ms)
      vad.processFrame(loud, 1200);

      // Frame 4 at t=1300: silence begins
      const silenceFrame1 = vad.processFrame(quiet, 1300);
      expect(silenceFrame1.state).toBe("silence_waiting");
      expect(countdownCalled).toBe(true);

      // Frame 5 at t=1850: silence past the 500ms timeout
      const silenceFrame2 = vad.processFrame(quiet, 1850);
      expect(speechEnded).toBe(true);
      expect(silenceFrame2.state).toBe("idle");
    });

    it("VoiceSettingsSchema validates hands-free VAD settings and defaults", () => {
      const parsed = VoiceSettingsSchema.parse({
        enabled: true,
        mode: "speech_and_text",
        speechEngine: "on-device",
        vadEnabled: true,
        silenceTimeoutMs: 1800,
      });

      expect(parsed.vadEnabled).toBe(true);
      expect(parsed.silenceTimeoutMs).toBe(1800);
      expect(parsed.speechEngine).toBe("on-device");
    });
  });

  describe("4. Calibrated Content Question Bank & Golden Evaluation Suite (Tracks 4.1 & 4.2, AI-025)", () => {
    it("Expanded question bank contains at least 12 questions for all 5 experience levels (balanced distribution)", () => {
      const counts: Record<string, number> = {};
      for (const q of SAMPLE_QUESTION_BANK) {
        counts[q.level] = (counts[q.level] || 0) + 1;
      }

      expect(counts["intern_fresher"]).toBeGreaterThanOrEqual(12);
      expect(counts["junior"]).toBeGreaterThanOrEqual(12);
      expect(counts["mid"]).toBeGreaterThanOrEqual(12);
      expect(counts["senior"]).toBeGreaterThanOrEqual(12);
      expect(counts["staff_plus"]).toBeGreaterThanOrEqual(12);
      // Exactly balanced across all 5 experience levels
      expect(counts["intern_fresher"]).toBe(counts["junior"]);
      expect(counts["junior"]).toBe(counts["mid"]);
      expect(counts["mid"]).toBe(counts["senior"]);
      expect(counts["senior"]).toBe(counts["staff_plus"]);
      expect(SAMPLE_QUESTION_BANK.length).toBeGreaterThanOrEqual(60);
    });

    it("Every question in the bank satisfies QuestionBankSchema with valid skill tags and metadata", () => {
      expect(() => QuestionBankSchema.parse(SAMPLE_QUESTION_BANK)).not.toThrow();

      for (const q of SAMPLE_QUESTION_BANK) {
        expect(q.id.length).toBeGreaterThan(4);
        expect(q.text.length).toBeGreaterThan(20);
        expect(q.difficulty).toBeGreaterThanOrEqual(1);
        expect(q.difficulty).toBeLessThanOrEqual(5);
        expect(q.followUps.length).toBeGreaterThanOrEqual(2);
        expect(q.rubricHints.length).toBeGreaterThanOrEqual(3);
        expect(q.source).toBe("Abhyas Core Bank");
        expect(q.license).toBe("MIT");

        // Verify all skill tags belong to the canonical taxonomy
        for (const tag of q.skillTags) {
          expect(CANONICAL_SKILL_IDS.has(tag)).toBe(true);
        }
      }
    });

    it("Evaluates Golden Set v0 with Mean Absolute Score difference <= 0.5 (MAS stability)", async () => {
      const goldenSetPath = path.resolve(process.cwd(), "docs/evals/golden-set-v0.json");
      const raw = fs.readFileSync(goldenSetPath, "utf-8");
      const transcripts: Array<{
        id: string;
        level: ExperienceLevel;
        targetRole: string;
        question: string;
        skillTags: string[];
        answer: string;
        candidateProfile: {
          role: string;
          level: string;
          skills: string[];
          companies: string[];
        };
      }> = JSON.parse(raw);

      expect(transcripts.length).toBeGreaterThanOrEqual(20);

      const run1Scores: number[] = [];
      const run2Scores: number[] = [];

      for (const item of transcripts) {
        const rubric = CANONICAL_RUBRICS[item.level];

        const res1 = await evaluateAnswer({
          question: { text: item.question, skillTags: item.skillTags, difficulty: 3 },
          answerText: item.answer,
          level: item.level,
          targetRole: item.targetRole,
          rubric,
          forceBasic: true,
        });

        const res2 = await evaluateAnswer({
          question: { text: item.question, skillTags: item.skillTags, difficulty: 3 },
          answerText: item.answer,
          level: item.level,
          targetRole: item.targetRole,
          rubric,
          forceBasic: true,
        });

        if (res1.status === "scored" && res2.status === "scored") {
          run1Scores.push(res1.turnScore);
          run2Scores.push(res2.turnScore);
        }
      }

      let diffSum = 0;
      for (let i = 0; i < run1Scores.length; i++) {
        diffSum += Math.abs(run1Scores[i]! - run2Scores[i]!);
      }
      const mas = diffSum / run1Scores.length;
      expect(mas).toBeLessThanOrEqual(0.5);
    });

    it("Enforces hallucination-free grounded rewrite guardrail on all golden transcripts", async () => {
      const goldenSetPath = path.resolve(process.cwd(), "docs/evals/golden-set-v0.json");
      const raw = fs.readFileSync(goldenSetPath, "utf-8");
      const transcripts: Array<{
        id: string;
        level: ExperienceLevel;
        targetRole: string;
        question: string;
        answer: string;
        candidateProfile: {
          role: string;
          level: string;
          skills: string[];
          companies: string[];
        };
      }> = JSON.parse(raw);

      for (const item of transcripts) {
        const mockProfile: StructuredProfile = {
          id: `profile-${item.id}`,
          inputHash: `hash-${item.id}`,
          condensed: `${item.candidateProfile.role} at ${item.candidateProfile.companies.join(", ")} with skills ${item.candidateProfile.skills.join(", ")}`,
          json: item.candidateProfile,
          promptVersion: 1,
        };

        const rewrite = await generateGroundedRewrite({
          questionText: item.question,
          originalAnswer: item.answer,
          level: item.level,
          targetRole: item.targetRole,
          profile: mockProfile,
        });

        expect(rewrite.rewrittenAnswer.length).toBeGreaterThan(15);
        const check = validateGrounding(rewrite.rewrittenAnswer, mockProfile, item.question);
        expect(check.isGrounded).toBe(true);
        expect(check.unsupportedClaims.length).toBe(0);
      }
    });
  });
});
