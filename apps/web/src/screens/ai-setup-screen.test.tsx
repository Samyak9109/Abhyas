// FR-005, FR-021, FR-032, PG-09: Tests for AI setup screen (M1.2).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  decryptApiKey,
  GEMINI_FIXTURES,
  MemoryStorageAdapter,
  ANTHROPIC_FIXTURES,
  HUGGINGFACE_FIXTURES,
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
  ollamaTags?: { status: number; body: unknown };
  ollamaError?: Error;
  anthropicModels?: { status: number; body: unknown };
  huggingfaceModels?: { status: number; body: unknown };
}): typeof fetch {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = input.toString();

    if (url.includes("api.anthropic.com")) {
      const cfg = responseMap.anthropicModels || {
        status: 200,
        body: ANTHROPIC_FIXTURES.modelsSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("huggingface.co")) {
      if (url.includes("/chat/completions")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "pong" } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      const cfg = responseMap.huggingfaceModels || {
        status: 200,
        body: HUGGINGFACE_FIXTURES.modelsSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("11434") || url.includes("/api/tags")) {
      if (responseMap.ollamaError) {
        throw responseMap.ollamaError;
      }
      const cfg = responseMap.ollamaTags || {
        status: 200,
        body: {
          models: [
            { name: "llama3.2:3b", size: 2000000000, modified_at: "2024-01-01T00:00:00Z" },
            { name: "mistral:7b", size: 4000000000, modified_at: "2024-01-01T00:00:00Z" },
          ],
        },
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

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

  describe("Device Rules Enforcement (M3.5, FR-022, ADR-013)", () => {
    it("blocks local mode selection on phones and displays explanation message", async () => {
      const storage = new MemoryStorageAdapter();
      const mockMobileRuntime = {
        hasWebGpu: vi.fn().mockResolvedValue(false),
        isMobileDevice: vi.fn().mockReturnValue(true),
      };

      render(
        <AISetupScreen
          storage={storage}
          onComplete={() => {}}
          hardwareRuntime={mockMobileRuntime}
        />
      );

      // Local model radio cards should be disabled on phone
      const localRadio = screen.getByRole("radio", { name: /local model \(webllm\)/i });
      expect(localRadio).toHaveProperty("disabled", true);
      const ollamaRadio = screen.getByRole("radio", { name: /ollama \(local server\)/i });
      expect(ollamaRadio).toHaveProperty("disabled", true);
      expect(screen.getAllByText("PC ONLY").length).toBeGreaterThanOrEqual(1);

      // Explanation message should appear
      expect(screen.getByText(/Local mode blocked on phones/i)).toBeDefined();
      expect(
        screen.getAllByText(/Local models are disabled on mobile devices/i).length
      ).toBeGreaterThanOrEqual(1);

      // Clicking disabled radio should not select local model
      fireEvent.click(localRadio);
      expect(screen.queryByText("In-Browser Local Model (WebLLM)")).toBeNull();
      fireEvent.click(ollamaRadio);
      expect(screen.queryByText("Ollama (Local Server) Setup")).toBeNull();
      expect(screen.getByText("Google Gemini Setup")).toBeDefined();
    });

    it("resets existing webllm provider to cloud provider on phone and shows warning", async () => {
      const storage = new MemoryStorageAdapter();
      await storage.put("providers", {
        id: "webllm",
        kind: "webllm",
        modelRoles: { interviewer: "SmolLM2-1.7B-Instruct-q4f16_1-MLC" },
      });

      const mockMobileRuntime = {
        hasWebGpu: vi.fn().mockResolvedValue(false),
        isMobileDevice: vi.fn().mockReturnValue(true),
      };

      render(
        <AISetupScreen
          storage={storage}
          onComplete={() => {}}
          hardwareRuntime={mockMobileRuntime}
        />
      );

      // Should fall back to gemini instead of webllm on phone
      await waitFor(() => {
        expect(screen.getByText("Google Gemini Setup")).toBeDefined();
      });

      expect(screen.getByText(/Local mode blocked on phones/i)).toBeDefined();
    });

    it("resets existing ollama provider to cloud provider on phone", async () => {
      const storage = new MemoryStorageAdapter();
      await storage.put("providers", {
        id: "ollama",
        kind: "ollama",
        baseUrl: "http://localhost:11434",
        modelRoles: { interviewer: "llama3.2:3b" },
      });

      const mockMobileRuntime = {
        hasWebGpu: vi.fn().mockResolvedValue(false),
        isMobileDevice: vi.fn().mockReturnValue(true),
      };

      render(
        <AISetupScreen
          storage={storage}
          onComplete={() => {}}
          hardwareRuntime={mockMobileRuntime}
        />
      );

      // Should fall back to gemini instead of ollama on phone
      await waitFor(() => {
        expect(screen.getByText("Google Gemini Setup")).toBeDefined();
      });

      expect(screen.getByText(/Local mode blocked on phones/i)).toBeDefined();
    });
  });

  describe("M3.6: Ollama & Local Servers (PG-09, FR-005, FR-023, ADR-013)", () => {
    it("handles Ollama provider selection, defaults baseUrl to http://localhost:11434, and allows testing without API key", async () => {
      const storage = new MemoryStorageAdapter();
      render(<AISetupScreen storage={storage} onComplete={() => {}} />);

      // Select Ollama
      const ollamaRadio = screen.getByRole("radio", { name: /ollama \(local server\)/i });
      fireEvent.click(ollamaRadio);

      // Verify header and CORS callout
      expect(screen.getByText("Ollama Local Server")).toBeDefined();
      expect(screen.getByText(/Browser CORS Requirement/i)).toBeDefined();
      expect(screen.getByText(/Local Models Guide/i)).toBeDefined();

      // Verify baseUrl input has default
      const baseUrlInput = screen.getByLabelText(/base url/i) as HTMLInputElement;
      expect(baseUrlInput.value).toBe("http://localhost:11434");

      // Test Ollama connection button should be enabled without API key
      const testBtn = screen.getByRole("button", { name: /test ollama connection/i });
      expect(testBtn).toHaveProperty("disabled", false);
    });

    it("connects to Ollama, discovers models, and saves provider configuration", async () => {
      const storage = new MemoryStorageAdapter();
      const onComplete = vi.fn();
      const fetchFn = createMockFetch({});

      render(<AISetupScreen storage={storage} onComplete={onComplete} fetchFn={fetchFn} />);

      // Select Ollama
      const ollamaRadio = screen.getByRole("radio", { name: /ollama \(local server\)/i });
      fireEvent.click(ollamaRadio);

      // Click test button
      const testBtn = screen.getByRole("button", { name: /test ollama connection/i });
      fireEvent.click(testBtn);

      // Verify success
      await waitFor(() => {
        expect(screen.getByText(/connection verified/i)).toBeDefined();
      });

      // Verify model picker populated
      const modelSelect = screen.getByLabelText(/choose model/i) as HTMLSelectElement;
      expect(modelSelect).toBeDefined();
      expect(modelSelect.value).toBe("llama3.2:3b");

      // Save and continue
      const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
      expect(nextBtn).toHaveProperty("disabled", false);
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      // Check stored provider
      const providers = (await storage.getAll("providers")) as ProviderRow[];
      expect(providers.length).toBe(1);
      expect(providers[0]?.kind).toBe("ollama");
      expect(providers[0]?.baseUrl).toBe("http://localhost:11434");
      expect(providers[0]?.modelRoles?.interviewer).toBe("llama3.2:3b");
    });

    it("displays CORS diagnostic callout and guide link when Ollama connection fails due to CORS", async () => {
      const storage = new MemoryStorageAdapter();
      const corsErrorFetch: typeof fetch = async () => {
        throw new TypeError("Failed to fetch");
      };

      render(<AISetupScreen storage={storage} onComplete={() => {}} fetchFn={corsErrorFetch} />);

      // Select Ollama
      const ollamaRadio = screen.getByRole("radio", { name: /ollama \(local server\)/i });
      fireEvent.click(ollamaRadio);

      // Test connection
      const testBtn = screen.getByRole("button", { name: /test ollama connection/i });
      fireEvent.click(testBtn);

      // Should show CORS error
      await waitFor(() => {
        expect(screen.getByText("CORS Restriction Blocked Access")).toBeDefined();
        expect(screen.getAllByText(/OLLAMA_ORIGINS="\*"/i).length).toBeGreaterThanOrEqual(1);
      });

      // Guide link in error area
      expect(screen.getByRole("link", { name: /read ollama setup guide/i })).toBeDefined();
    });

    it("handles OpenAI-compatible local server with CORS classification when localhost fails", async () => {
      const storage = new MemoryStorageAdapter();
      const localServerErrorFetch: typeof fetch = async () => {
        throw new TypeError("Failed to fetch");
      };

      render(
        <AISetupScreen storage={storage} onComplete={() => {}} fetchFn={localServerErrorFetch} />
      );

      // Select OpenAI-compatible
      const openAiCompRadio = screen.getByRole("radio", { name: /openai-compatible/i });
      fireEvent.click(openAiCompRadio);

      // Change baseUrl to local LM Studio endpoint
      const baseUrlInput = screen.getByLabelText(/base url/i);
      fireEvent.change(baseUrlInput, { target: { value: "http://localhost:1234/v1" } });

      // Test connection without API key (allowed for localhost)
      const testBtn = screen.getByRole("button", { name: /test connection/i });
      expect(testBtn).toHaveProperty("disabled", false);
      fireEvent.click(testBtn);

      // Should show CORS error
      await waitFor(() => {
        expect(screen.getByText("CORS Restriction Blocked Access")).toBeDefined();
        expect(screen.getAllByText(/LM Studio/i).length).toBeGreaterThanOrEqual(2);
      });
    });

    it("supports Anthropic Claude provider setup, connection testing, and saving (M7.1)", async () => {
      const storage = new MemoryStorageAdapter();
      const fetchFn = createMockFetch({});
      let completed = false;

      render(
        <AISetupScreen
          storage={storage}
          onComplete={() => {
            completed = true;
          }}
          fetchFn={fetchFn}
        />
      );

      const anthropicRadio = screen.getByRole("radio", { name: /anthropic \(claude\)/i });
      fireEvent.click(anthropicRadio);

      expect(screen.getByRole("heading", { name: /anthropic claude api setup/i })).toBeTruthy();

      const keyInput = screen.getByLabelText(/api key/i);
      fireEvent.change(keyInput, { target: { value: "sk-ant-valid-key-999" } });

      const testBtn = screen.getByRole("button", { name: /test connection/i });
      expect(testBtn).toHaveProperty("disabled", false);
      fireEvent.click(testBtn);

      expect(await screen.findByText(/connection verified/i)).toBeTruthy();

      const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(completed).toBe(true);
      });

      const providers = (await storage.getAll("providers")) as ProviderRow[];
      expect(providers.length).toBe(1);
      expect(providers[0]?.kind).toBe("anthropic");
      expect(providers[0]?.key).toBe("sk-ant-valid-key-999");
    });

    it("supports Hugging Face provider setup, connection testing, and saving (M7.1)", async () => {
      const storage = new MemoryStorageAdapter();
      const fetchFn = createMockFetch({});
      let completed = false;

      render(
        <AISetupScreen
          storage={storage}
          onComplete={() => {
            completed = true;
          }}
          fetchFn={fetchFn}
        />
      );

      const hfRadio = screen.getByRole("radio", { name: /hugging face/i });
      fireEvent.click(hfRadio);

      expect(
        screen.getByRole("heading", { name: /hugging face serverless inference/i })
      ).toBeTruthy();

      const tokenInput = screen.getByLabelText(/user access token/i);
      fireEvent.change(tokenInput, { target: { value: "hf_validToken12345" } });

      const testBtn = screen.getByRole("button", { name: /test connection/i });
      expect(testBtn).toHaveProperty("disabled", false);
      fireEvent.click(testBtn);

      expect(await screen.findByText(/connection verified/i)).toBeTruthy();

      const nextBtn = screen.getByRole("button", { name: /next: add your profile/i });
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(completed).toBe(true);
      });

      const providers = (await storage.getAll("providers")) as ProviderRow[];
      expect(providers.length).toBe(1);
      expect(providers[0]?.kind).toBe("huggingface");
      expect(providers[0]?.key).toBe("hf_validToken12345");
    });
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
