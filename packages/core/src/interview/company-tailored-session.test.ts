// FR-025, AI-013, AI-014, AI-021: Integration test for company-tailored session runner and evaluation.
import { describe, expect, it, vi } from "vitest";
import { SessionRunner } from "./session-runner.js";
import { MemoryStorageAdapter } from "../storage/memory-storage.js";
import type { ProviderAdapter } from "../providers/types.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";
import type { CompanyPack } from "../schemas/pack.schema.js";
import type { Evaluation } from "../schemas/evaluation.schema.js";

describe("company-tailored interview session (FR-025, AI-014, AI-021)", () => {
  const stripePack: CompanyPack = {
    schemaVersion: 1,
    slug: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    aliases: ["Stripe Inc."],
    retrievedAt: "2026-10-18T10:00:00.000Z",
    ttlDays: 90,
    coverage: "high",
    overview: {
      value: "Financial infrastructure platform for internet commerce.",
      confidence: "documented",
      sources: [{ url: "https://stripe.com", title: "About", retrievedAt: "2026-10-18" }],
    },
    techStack: {
      value: ["Ruby", "Go", "PostgreSQL", "Kafka"],
      confidence: "documented",
      sources: [{ url: "https://stripe.com/tech", title: "Tech", retrievedAt: "2026-10-18" }],
    },
    values: {
      value: [
        { name: "Users First", description: "Prioritize merchant prosperity." },
        { name: "Meticulous Craftsmanship", description: "Polish APIs to highest standard." },
      ],
      confidence: "documented",
      sources: [{ url: "https://stripe.com/culture", title: "Culture", retrievedAt: "2026-10-18" }],
    },
  };

  const sampleQuestions: SelectedQuestion[] = [
    {
      id: "q-1",
      bankId: "b-1",
      text: "How do you design an idempotent payment processing endpoint?",
      difficulty: 0.5,
      skillTags: ["backend_apis", "databases"],
      isUnverified: false,
    },
    {
      id: "q-2",
      bankId: "b-2",
      text: "Describe a time you prioritized customer needs over internal velocity.",
      difficulty: 0.5,
      skillTags: ["behavioral", "communication"],
      isUnverified: false,
    },
  ];

  const plan: SessionPlan = {
    sessionId: "sess-tailored-01",
    type: "technical",
    length: 5,
    style: "standard",
    inputMode: "text",
    level: "senior",
    targetRole: "Backend Engineer",
    createdAt: "2026-10-18T10:00:00.000Z",
    companySlug: "stripe",
    companyName: "Stripe",
  };

  it("passes company values to answer evaluator and context builder when company pack is provided", async () => {
    const storage = new MemoryStorageAdapter();
    const evaluatorCalls: Array<{ role: string; content: string }[]> = [];
    let streamCalledWithContext = "";

    const mockProvider: ProviderAdapter = {
      id: "openai",
      capabilities: async () => ({
        streaming: true,
        jsonMode: "native",
        maxContextTokens: 8192,
      }),
      listModels: async () => ({
        ok: true,
        value: [{ id: "mock-model", label: "Mock Model" }],
      }),
      testConnection: async () => ({ ok: true, value: undefined }),
      generateObject: async <T>(messages: { role: string; content: string }[]) => {
        evaluatorCalls.push(messages);
        const mockEval: Evaluation = {
          criteria: {
            relevance: { score: 3, reason: "Good relevance", evidence: "idempotency key" },
            structure: { score: 3, reason: "Clear structure", evidence: "first step" },
            depth: { score: 2, reason: "Needs deeper distributed race discussion", evidence: "Redis lock" },
            clarity: { score: 3, reason: "Clear", evidence: "returns 200" },
            levelFit: { score: 3, reason: "Fits level", evidence: "solid baseline" },
          },
          skillScores: { backend_apis: 70, databases: 65 },
          topFix: "Address distributed transaction rollback race conditions.",
          unsupportedClaims: [],
        };
        return {
          ok: true as const,
          value: mockEval as T,
        };
      },
      stream: async function* (messages) {
        const sysMsg = messages.find((m) => m.role === "system")?.content ?? "";
        streamCalledWithContext = sysMsg;
        yield { delta: "How do you handle lock expiration if the payment gateway times out?", isComplete: true };
      },
    };

    const runner = new SessionRunner({
      plan,
      questions: sampleQuestions,
      storage,
      provider: mockProvider,
      companyPack: stripePack,
      autoStart: true,
    });

    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("await_answer");
    });

    // Submit answer to question 1
    await runner.dispatch({
      type: "SUBMIT",
      answerText: "I store a unique idempotency key in Redis with a TTL and check it inside a transaction.",
    });

    await vi.waitFor(() => {
      expect(evaluatorCalls.length).toBeGreaterThan(0);
    });

    // 1. Verify evaluator received company values context
    const userPrompt = evaluatorCalls[0]?.find((m) => m.role === "user")?.content ?? "";
    expect(userPrompt).toContain("Company Values Considered: Users First: Prioritize merchant prosperity., Meticulous Craftsmanship: Polish APIs to highest standard.");

    // 2. Wait for follow-up probe stream to be called
    await vi.waitFor(() => {
      expect(streamCalledWithContext).toBeTruthy();
    });

    // Verify follow-up generation received company context in Layer 1 and Layer 4
    expect(streamCalledWithContext).toContain("You are conducting a realistic mock interview tailored for Stripe");
    expect(streamCalledWithContext).toContain('<company_data name="Stripe">');
    expect(streamCalledWithContext).toContain("Documented Tech Stack: Ruby, Go, PostgreSQL, Kafka");
  });

  it("strictly excludes company context and injects anti-hallucination directive when company pack is absent", async () => {
    const storage = new MemoryStorageAdapter();
    const evaluatorCalls: Array<{ role: string; content: string }[]> = [];
    let streamCalledWithContext = "";

    const mockProvider: ProviderAdapter = {
      id: "openai",
      capabilities: async () => ({
        streaming: true,
        jsonMode: "native",
        maxContextTokens: 8192,
      }),
      listModels: async () => ({
        ok: true,
        value: [{ id: "mock-model", label: "Mock Model" }],
      }),
      testConnection: async () => ({ ok: true, value: undefined }),
      generateObject: async <T>(messages: { role: string; content: string }[]) => {
        evaluatorCalls.push(messages);
        const mockEval: Evaluation = {
          criteria: {
            relevance: { score: 3, reason: "Good", evidence: "idempotency key" },
            structure: { score: 3, reason: "Good", evidence: "first step" },
            depth: { score: 2, reason: "Needs deeper discussion", evidence: "lock" },
            clarity: { score: 3, reason: "Good", evidence: "200" },
            levelFit: { score: 3, reason: "Good", evidence: "solid" },
          },
          skillScores: { backend_apis: 70 },
          topFix: "Address rollback mechanisms.",
          unsupportedClaims: [],
        };
        return {
          ok: true as const,
          value: mockEval as T,
        };
      },
      stream: async function* (messages) {
        const sysMsg = messages.find((m) => m.role === "system")?.content ?? "";
        streamCalledWithContext = sysMsg;
        yield { delta: "How do you handle edge cases in state verification?", isComplete: true };
      },
    };

    const generalPlan: SessionPlan = {
      ...plan,
      sessionId: "sess-general-01",
      companySlug: undefined,
      companyName: undefined,
    };

    const runner = new SessionRunner({
      plan: generalPlan,
      questions: sampleQuestions,
      storage,
      provider: mockProvider,
      companyPack: null,
      autoStart: true,
    });

    await vi.waitFor(() => {
      expect(runner.getState().status).toBe("await_answer");
    });

    await runner.dispatch({
      type: "SUBMIT",
      answerText: "I use idempotency keys and database unique constraints.",
    });

    await vi.waitFor(() => {
      expect(evaluatorCalls.length).toBeGreaterThan(0);
    });

    // 1. Verify evaluator prompt does NOT contain company values
    const userPrompt = evaluatorCalls[0]?.find((m) => m.role === "user")?.content ?? "";
    expect(userPrompt).not.toContain("Company Values Considered:");

    await vi.waitFor(() => {
      expect(streamCalledWithContext).toBeTruthy();
    });

    // 2. Verify follow-up context contains strict anti-hallucination directive and no company data block
    expect(streamCalledWithContext).toContain("No verified company context is available");
    expect(streamCalledWithContext).toContain("Do NOT assert, assume, or invent specific facts");
    expect(streamCalledWithContext).not.toContain("<company_data");
    expect(streamCalledWithContext).not.toContain("Stripe");
  });
});
