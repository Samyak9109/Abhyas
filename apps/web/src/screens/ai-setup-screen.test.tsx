// FR-005, FR-021, FR-032, PG-09: Tests for AI setup screen (M1.2).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  decryptApiKey,
  GEMINI_FIXTURES,
  MemoryStorageAdapter,
  type ProviderRow,
} from "@abhyas/core";
import { AISetupScreen } from "./AISetupScreen";

const MOCK_GEMINI_MODELS = {
  models: [
    {
      name: "models/gemini-1.5-flash",
      displayName: "Gemini 1.5 Flash",
      supportedGenerationMethods: ["generateContent"],
    },
    {
      name: "models/gemini-1.5-pro",
      displayName: "Gemini 1.5 Pro",
      supportedGenerationMethods: ["generateContent"],
    },
  ],
};

const MOCK_OPENAI_MODELS = {
  data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o" }],
};

function createMockFetch(responseMap: {
  geminiModels?: { status: number; body: unknown };
  openaiModels?: { status: number; body: unknown };
}): typeof fetch {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = input.toString();

    if (url.includes("generativelanguage.googleapis.com")) {
      const cfg = responseMap.geminiModels || {
        status: 200,
        body: MOCK_GEMINI_MODELS,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("api.openai.com") || url.includes("groq.com")) {
      const cfg = responseMap.openaiModels || {
        status: 200,
        body: MOCK_OPENAI_MODELS,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

describe("M1.2: AISetupScreen (PG-09)", () => {
  it("renders initial state with provider cards and disabled next button", () => {
    const storage = new MemoryStorageAdapter();
    render(<AISetupScreen storage={storage} onComplete={() => {}} />);

    expect(screen.getByRole("heading", { name: /choose your ai source/i })).toBeTruthy();
    expect(screen.getAllByText(/google gemini/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/openai-compatible/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /next: add your profile/i })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("disables Test connection button when API key is empty", async () => {
    const storage = new MemoryStorageAdapter();
    render(<AISetupScreen storage={storage} onComplete={() => {}} />);

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    expect(testBtn).toHaveProperty("disabled", true);
  });

  it("handles successful Gemini connection test, displays model picker, cost estimate, and enables Next", async () => {
    const storage = new MemoryStorageAdapter();
    const fetchFn = createMockFetch({});

    render(<AISetupScreen storage={storage} onComplete={() => {}} fetchFn={fetchFn} />);

    const keyInput = screen.getByLabelText(/api key/i);
    fireEvent.change(keyInput, { target: { value: "AIzaSyValidGeminiKey123" } });

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    expect(testBtn).toHaveProperty("disabled", false);
    fireEvent.click(testBtn);

    expect(await screen.findByText(/connection verified/i)).toBeTruthy();
    expect(screen.getByLabelText(/choose model/i)).toBeTruthy();
    expect(screen.getByText(/estimated cost/i)).toBeTruthy();

    const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
    expect(nextBtn).toHaveProperty("disabled", false);
  });

  it("classifies authentication failures during connection test", async () => {
    const storage = new MemoryStorageAdapter();
    const fetchFn = createMockFetch({
      geminiModels: { status: 400, body: GEMINI_FIXTURES.authError },
    });

    render(<AISetupScreen storage={storage} onComplete={() => {}} fetchFn={fetchFn} />);

    const keyInput = screen.getByLabelText(/api key/i);
    fireEvent.change(keyInput, { target: { value: "invalid-key" } });

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    fireEvent.click(testBtn);

    expect(await screen.findByText(/authentication failed/i)).toBeTruthy();
    expect(screen.getByText(/invalid gemini api key/i)).toBeTruthy();
  });

  it("classifies rate limit / quota exceeded during connection test", async () => {
    const storage = new MemoryStorageAdapter();
    const fetchFn = createMockFetch({
      geminiModels: { status: 429, body: GEMINI_FIXTURES.quotaError },
    });

    render(<AISetupScreen storage={storage} onComplete={() => {}} fetchFn={fetchFn} />);

    const keyInput = screen.getByLabelText(/api key/i);
    fireEvent.change(keyInput, { target: { value: "quota-exhausted-key" } });

    const testBtn = screen.getByRole("button", { name: /test connection/i });
    fireEvent.click(testBtn);

    expect(await screen.findByText(/quota or rate limit exceeded/i)).toBeTruthy();
  });

  it("saves unencrypted key in storage when passphrase encryption is off", async () => {
    const storage = new MemoryStorageAdapter();
    const fetchFn = createMockFetch({});
    const onComplete = vi.fn();

    render(<AISetupScreen storage={storage} onComplete={onComplete} fetchFn={fetchFn} />);

    const keyInput = screen.getByLabelText(/api key/i);
    fireEvent.change(keyInput, { target: { value: "AIzaSyPlaintextKey" } });

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    await screen.findByText(/connection verified/i);

    const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const providers = (await storage.getAll("providers")) as ProviderRow[];
    expect(providers.length).toBe(1);
    expect(providers[0]?.kind).toBe("gemini");
    expect(providers[0]?.key).toBe("AIzaSyPlaintextKey");
    expect(providers[0]?.encryptedKey).toBeUndefined();
  });

  it("encrypts key with WebCrypto when passphrase encryption is enabled", async () => {
    const storage = new MemoryStorageAdapter();
    const fetchFn = createMockFetch({});
    const onComplete = vi.fn();

    render(<AISetupScreen storage={storage} onComplete={onComplete} fetchFn={fetchFn} />);

    const keyInput = screen.getByLabelText(/api key/i);
    fireEvent.change(keyInput, { target: { value: "AIzaSyKeyToEncrypt" } });

    // Enable passphrase encryption
    const encryptSwitch = screen.getByRole("switch", { name: /encrypt key at rest/i });
    fireEvent.click(encryptSwitch);

    const passphraseInput = await screen.findByLabelText(/passphrase for key encryption/i);
    fireEvent.change(passphraseInput, { target: { value: "my-secret-passphrase" } });

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    await screen.findByText(/connection verified/i);

    const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
    fireEvent.click(nextBtn);

    await waitFor(() => expect(onComplete).toHaveBeenCalled());

    const providers = (await storage.getAll("providers")) as ProviderRow[];
    expect(providers.length).toBe(1);
    expect(providers[0]?.key).toBeUndefined();
    expect(providers[0]?.encryptedKey).toBeDefined();

    // Verify key can be decrypted with the passphrase
    const decrypted = await decryptApiKey(providers[0]!.encryptedKey!, "my-secret-passphrase");
    expect(decrypted).toBe("AIzaSyKeyToEncrypt");
  });

  it("supports OpenAI-compatible provider with base URL input", async () => {
    const storage = new MemoryStorageAdapter();
    const fetchFn = createMockFetch({});

    render(<AISetupScreen storage={storage} onComplete={() => {}} fetchFn={fetchFn} />);

    const openaiCompatibleRadio = screen.getByRole("radio", { name: /openai-compatible/i });
    fireEvent.click(openaiCompatibleRadio);

    expect(screen.getByLabelText(/endpoint base url/i)).toBeTruthy();

    const keyInput = screen.getByLabelText(/api key/i);
    fireEvent.change(keyInput, { target: { value: "sk-groq-test-key" } });

    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    expect(await screen.findByText(/connection verified/i)).toBeTruthy();
  });

  it("toggles local model mode and renders hardware capability benchmark card (FR-024, M3.1)", async () => {
    const storage = new MemoryStorageAdapter();
    const mockRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      getAdapterInfo: async () => ({ description: "NVIDIA RTX 4070" }),
      runComputeBenchmark: async () => ({ tokensPerSecond: 28, latencyMs: 90 }),
    };

    render(<AISetupScreen storage={storage} onComplete={() => {}} hardwareRuntime={mockRuntime} />);

    const localSwitch = screen.getByRole("switch", { name: /use a local model/i });
    expect(localSwitch).toBeDefined();

    fireEvent.click(localSwitch);

    await waitFor(() => {
      expect(screen.getByText("Hardware Capabilities & WebGPU")).toBeDefined();
    });

    expect(screen.getByText("NVIDIA RTX 4070")).toBeDefined();
  });

  it("selects Local model (WebLLM), verifies without API key, and saves provider (M3.2)", async () => {
    const storage = new MemoryStorageAdapter();
    const onComplete = vi.fn();
    const mockRuntime = {
      hasWebGpu: vi.fn().mockResolvedValue(true),
      isMobileDevice: vi.fn().mockReturnValue(false),
      getConcurrency: vi.fn().mockReturnValue(8),
      getDeviceMemoryGb: vi.fn().mockReturnValue(16),
      getStorageQuotaMb: vi.fn().mockResolvedValue(50000),
      runComputeBenchmark: vi.fn().mockResolvedValue({ tokensPerSecond: 20, latencyMs: 50 }),
    };

    render(
      <AISetupScreen storage={storage} onComplete={onComplete} hardwareRuntime={mockRuntime} />
    );

    // Click Local model (WebLLM) radio card
    const localRadio = screen.getByRole("radio", { name: /local model \(webllm\)/i });
    fireEvent.click(localRadio);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Local Model (WebLLM)")).toBeDefined();
      expect(screen.getByText(/Text-Only Interview Mode/i)).toBeDefined();
    });

    // Verify local model button
    const verifyBtn = screen.getByRole("button", { name: /verify local model/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText("Local model verified")).toBeDefined();
    });

    // Save and continue
    const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
    expect(nextBtn).toHaveProperty("disabled", false);
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });

    const providers = (await storage.getAll("providers")) as ProviderRow[];
    expect(providers.length).toBe(1);
    expect(providers[0]?.kind).toBe("webllm");
    expect(providers[0]?.key).toBeUndefined();
  });

  describe("Accessibility (axe)", () => {
    it("has no axe violations in default state under Ink theme", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const storage = new MemoryStorageAdapter();
      const { container } = render(<AISetupScreen storage={storage} onComplete={() => {}} />);

      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations in default state under Paper theme", async () => {
      document.documentElement.setAttribute("data-theme", "paper");
      const storage = new MemoryStorageAdapter();
      const { container } = render(<AISetupScreen storage={storage} onComplete={() => {}} />);

      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
