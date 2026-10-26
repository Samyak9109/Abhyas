// FR-005, FR-021, FR-032, PG-09: AI setup screen (Step 1 of 3).
// Connects an AI source with bring-your-own-key, direct browser calls,
// optional WebCrypto passphrase encryption, connection test with classified errors,
// model picker, and cost estimation.
import React, { useEffect, useMemo, useState } from "react";
import {
  encryptApiKey,
  estimateSessionCost,
  formatBytes,
  GeminiAdapter,
  OpenAICompatibleAdapter,
  OllamaAdapter,
  AnthropicAdapter,
  HuggingFaceAdapter,
  detectHardwareCapabilities,
  isPhoneDevice,
  type ModelInfo,
  type ProviderError,
  type ProviderRow,
  type StorageAdapter,
  type HardwareRuntime,
} from "@abhyas/core";
import { CURATED_MODELS } from "@abhyas/content";
import {
  BrandMark,
  Button,
  Callout,
  HardwareBenchmarkCard,
  Input,
  RadioCard,
  SecretInput,
  Stepper,
  Switch,
} from "../components";
import { getInstalledModels, getLocalEngineAdapter } from "../services/local-engine";

interface AISetupScreenProps {
  storage: StorageAdapter;
  onComplete: () => void;
  onNavigateSettings?: () => void;
  onNavigateModelManager?: () => void;
  onNavigateHome?: () => void;
  /** Optional custom fetch implementation for testing */
  fetchFn?: typeof fetch;
  /** Optional custom hardware runtime for capability testing (FR-024) */
  hardwareRuntime?: HardwareRuntime;
}

type ProviderChoice =
  | "gemini"
  | "openai"
  | "openai-compatible"
  | "ollama"
  | "webllm"
  | "anthropic"
  | "huggingface";

const SETUP_STEPS = [
  { id: "ai", label: "AI Setup" },
  { id: "profile", label: "Profile" },
  { id: "start", label: "Start" },
];

export const AISetupScreen: React.FC<AISetupScreenProps> = ({
  storage,
  onComplete,
  onNavigateSettings,
  onNavigateModelManager,
  onNavigateHome,
  fetchFn,
  hardwareRuntime,
}) => {
  const isMobile = useMemo(() => isPhoneDevice(hardwareRuntime), [hardwareRuntime]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderChoice>(() => "gemini");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [useLocalModel, setUseLocalModel] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState<ProviderError | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load any existing provider configuration on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = (await storage.getAll("providers")) as ProviderRow[];
        if (cancelled || rows.length === 0) return;

        const existing = rows[0];
        if (!existing) return;

        if (
          existing.kind === "gemini" ||
          existing.kind === "openai" ||
          existing.kind === "openai-compatible" ||
          existing.kind === "ollama" ||
          existing.kind === "webllm" ||
          existing.kind === "anthropic" ||
          existing.kind === "huggingface"
        ) {
          if ((existing.kind === "webllm" || existing.kind === "ollama") && isMobile) {
            setSelectedProvider("gemini");
          } else {
            setSelectedProvider(existing.kind as ProviderChoice);
          }
        }
        if (existing.baseUrl) {
          setBaseUrl(existing.baseUrl);
        }
        if (existing.key) {
          setApiKey(existing.key);
        }
        if (existing.encryptedKey) {
          setUsePassphrase(true);
        }
        if (existing.modelRoles?.interviewer) {
          setSelectedModel(existing.modelRoles.interviewer);
        }
      } catch {
        // Fall back to empty initial form
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, isMobile]);

  const handleProviderChange = (provider: ProviderChoice) => {
    // Local mode blocked on phones (FR-022, ADR-013)
    if ((provider === "webllm" || provider === "ollama") && isMobile) {
      return;
    }
    setSelectedProvider(provider);
    setTestSuccess(false);
    setTestError(null);
    setModels([]);
    setSelectedModel("");
    if (provider === "gemini") {
      setBaseUrl("");
    } else if (provider === "openai") {
      setBaseUrl("https://api.openai.com/v1");
    } else if (provider === "openai-compatible") {
      setBaseUrl("https://api.groq.com/openai/v1");
    } else if (provider === "anthropic") {
      setBaseUrl("https://api.anthropic.com/v1");
    } else if (provider === "huggingface") {
      setBaseUrl("https://api-inference.huggingface.co/v1");
    } else if (provider === "ollama") {
      setBaseUrl("http://localhost:11434");
      setApiKey("");
      setUsePassphrase(false);
      setPassphrase("");
    } else {
      setBaseUrl("");
      setApiKey("");
      setUsePassphrase(false);
      setPassphrase("");
    }
  };

  const handleTestConnection = async () => {
    if (selectedProvider === "webllm") {
      setTesting(true);
      setTestError(null);
      setTestSuccess(false);

      try {
        const hw = await detectHardwareCapabilities(hardwareRuntime);
        if (!hw.supported) {
          setTestError({
            kind: "unknown",
            message:
              hw.unsupportedReason ??
              "Local models are disabled on this device. Please use Chrome 113+ on a desktop PC (FR-022, ADR-013).",
            retryable: false,
          });
          setTesting(false);
          return;
        }

        const adapter = getLocalEngineAdapter();
        const installed = await getInstalledModels(storage);
        const availableModelList =
          installed.length > 0
            ? installed.map((m) => ({ id: m.id, label: `${m.id} (${m.status})` }))
            : CURATED_MODELS.map((m) => ({
                id: m.id,
                label: `${m.name} (${formatBytes(m.sizeBytes)})`,
              }));

        setModels(availableModelList);
        const preferred =
          selectedModel || availableModelList[0]?.id || "SmolLM2-1.7B-Instruct-q4f16_1-MLC";
        setSelectedModel(preferred);

        if (adapter.isModelLoaded()) {
          setTestSuccess(true);
        } else {
          const testRes = await adapter.testConnection();
          if (testRes.ok || testRes.error.kind === "model_not_found") {
            setTestSuccess(true);
          } else {
            setTestError(testRes.error);
          }
        }
      } catch (err: unknown) {
        setTestError({
          kind: "unknown",
          message: err instanceof Error ? err.message : "Failed to verify local engine",
          retryable: true,
        });
      } finally {
        setTesting(false);
      }
      return;
    }

    const isLocalServer =
      selectedProvider === "ollama" ||
      (selectedProvider === "openai-compatible" &&
        (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")));

    if (!isLocalServer && !apiKey.trim()) {
      setTestError({
        kind: "auth",
        message: "Please enter an API key before testing connection.",
        retryable: false,
      });
      return;
    }

    setTesting(true);
    setTestError(null);
    setTestSuccess(false);

    try {
      let adapter;
      if (selectedProvider === "gemini") {
        adapter = new GeminiAdapter({
          apiKey,
          ...(fetchFn ? { fetchFn } : {}),
        });
      } else if (selectedProvider === "ollama") {
        adapter = new OllamaAdapter({
          baseUrl: baseUrl || "http://localhost:11434",
          apiKey: apiKey.trim() || undefined,
          ...(fetchFn ? { fetchFn } : {}),
        });
      } else if (selectedProvider === "anthropic") {
        adapter = new AnthropicAdapter({
          apiKey: apiKey.trim(),
          baseUrl: baseUrl || "https://api.anthropic.com/v1",
          ...(fetchFn ? { fetchFn } : {}),
        });
      } else if (selectedProvider === "huggingface") {
        adapter = new HuggingFaceAdapter({
          apiKey: apiKey.trim(),
          baseUrl: baseUrl || "https://api-inference.huggingface.co/v1",
          ...(fetchFn ? { fetchFn } : {}),
        });
      } else {
        adapter = new OpenAICompatibleAdapter({
          id: selectedProvider,
          apiKey: apiKey.trim() || undefined,
          baseUrl,
          allowCustomOrigin: selectedProvider === "openai-compatible",
          ...(fetchFn ? { fetchFn } : {}),
        });
      }

      const connRes = await adapter.testConnection();
      if (!connRes.ok) {
        setTestError(connRes.error);
        setTesting(false);
        return;
      }

      // Fetch model list from provider endpoint (FR-005)
      const modelsRes = await adapter.listModels();
      if (modelsRes.ok && modelsRes.value.length > 0) {
        setModels(modelsRes.value);
        // Default to first model or recommended model
        const preferred = modelsRes.value.find(
          (m) =>
            m.id.includes("sonnet") ||
            m.id.includes("flash") ||
            m.id.includes("4o-mini") ||
            m.id.includes("llama") ||
            m.id.includes("qwen")
        );
        setSelectedModel(preferred?.id || modelsRes.value[0]!.id);
      } else {
        const fallbackModel =
          selectedProvider === "gemini"
            ? "gemini-1.5-flash"
            : selectedProvider === "anthropic"
              ? "claude-3-5-sonnet-20241022"
              : selectedProvider === "huggingface"
                ? "meta-llama/Llama-3.2-3B-Instruct"
                : selectedProvider === "ollama"
                  ? "llama3.2"
                  : "gpt-4o-mini";
        setModels([{ id: fallbackModel, label: fallbackModel }]);
        setSelectedModel(fallbackModel);
      }

      setTestSuccess(true);
    } catch (err: unknown) {
      setTestError({
        kind: "unknown",
        message: err instanceof Error ? err.message : "Failed to connect to provider",
        retryable: true,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!testSuccess) return;

    if (selectedProvider === "webllm") {
      setSaving(true);
      try {
        const model = selectedModel || "SmolLM2-1.7B-Instruct-q4f16_1-MLC";
        const providerRow: ProviderRow = {
          id: "webllm",
          kind: "webllm",
          modelRoles: {
            interviewer: model,
            evaluator: model,
          },
          lastTestedAt: new Date().toISOString(),
        };

        await storage.put("providers", providerRow);
        await storage.put("settings", { key: "activeProviderId", value: "webllm" });
        onComplete();
      } catch (err: unknown) {
        setTestError({
          kind: "unknown",
          message: err instanceof Error ? err.message : "Failed to save local provider settings",
          retryable: false,
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    const isLocalServer =
      selectedProvider === "ollama" ||
      (selectedProvider === "openai-compatible" &&
        (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")));

    if (!isLocalServer && !apiKey.trim()) return;

    if (usePassphrase && apiKey && !passphrase.trim()) {
      setTestError({
        kind: "auth",
        message: "Please enter a passphrase to encrypt your key at rest, or disable encryption.",
        retryable: false,
      });
      return;
    }

    setSaving(true);
    try {
      let storedKey: string | undefined = apiKey.trim() || undefined;
      let encryptedKey: string | undefined;

      if (usePassphrase && apiKey) {
        encryptedKey = await encryptApiKey(apiKey, passphrase);
        storedKey = undefined;
      }

      const model =
        selectedModel ||
        (selectedProvider === "gemini"
          ? "gemini-1.5-flash"
          : selectedProvider === "anthropic"
            ? "claude-3-5-sonnet-20241022"
            : selectedProvider === "huggingface"
              ? "meta-llama/Llama-3.2-3B-Instruct"
              : selectedProvider === "ollama"
                ? "llama3.2"
                : "gpt-4o-mini");

      const providerRow: ProviderRow = {
        id: selectedProvider,
        kind: selectedProvider,
        baseUrl:
          selectedProvider === "openai-compatible" ||
          selectedProvider === "ollama" ||
          selectedProvider === "huggingface"
            ? baseUrl || (selectedProvider === "ollama" ? "http://localhost:11434" : undefined)
            : undefined,
        modelRoles: {
          interviewer: model,
          evaluator: model,
        },
        key: storedKey,
        encryptedKey,
        lastTestedAt: new Date().toISOString(),
      };

      await storage.put("providers", providerRow);
      await storage.put("settings", { key: "activeProviderId", value: selectedProvider });

      onComplete();
    } catch (err: unknown) {
      setTestError({
        kind: "unknown",
        message: err instanceof Error ? err.message : "Failed to save provider settings",
        retryable: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const costEstimate = selectedModel ? estimateSessionCost(10, selectedModel) : null;

  return (
    <div className="abh-setup-page">
      <header className="abh-setup-header">
        <div className="abh-setup-header-inner">
          <a
            className="abh-brand-lockup"
            href="/app/home"
            aria-label="Abhyas Home"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome?.();
            }}
          >
            <BrandMark size={24} />
            <span className="abh-wordmark" aria-hidden="true">
              Abhyas
            </span>
          </a>
          <Stepper steps={SETUP_STEPS} currentStepIndex={0} />
          {onNavigateSettings && (
            <Button variant="ghost" onClick={onNavigateSettings}>
              Settings
            </Button>
          )}
        </div>
      </header>

      <main className="abh-setup-main">
        <div className="abh-setup-grid">
          {/* Left Column: Provider Selection */}
          <section className="abh-setup-col-left" aria-labelledby="choose-provider-title">
            <span className="abh-step-badge">STEP 1 OF 3</span>
            <h1 id="choose-provider-title" className="abh-setup-title">
              Choose your AI source_
            </h1>
            <p className="abh-setup-intro">
              Abhyas runs directly in your browser and connects to your chosen AI provider with your
              own key. Your interview answers and resume are sent only to the provider you pick.
            </p>

            <h2 id="available-providers-heading" className="abh-panel-title">
              Available Providers
            </h2>

            <div
              className="abh-provider-cards"
              role="radiogroup"
              aria-labelledby="available-providers-heading"
            >
              <RadioCard
                title="Google Gemini"
                description="Gemini 1.5 Flash (free tier available with a Google AI Studio key)"
                monogram="G"
                tag="RECOMMENDED"
                checked={selectedProvider === "gemini"}
                onChange={() => handleProviderChange("gemini")}
              />

              <RadioCard
                title="OpenAI"
                description="GPT-4o mini or GPT-4o with your platform.openai.com API key"
                monogram="O"
                checked={selectedProvider === "openai"}
                onChange={() => handleProviderChange("openai")}
              />

              <RadioCard
                title="OpenAI-compatible"
                description="Groq, OpenRouter, Together, LM Studio, or local servers"
                monogram="⚡"
                checked={selectedProvider === "openai-compatible"}
                onChange={() => handleProviderChange("openai-compatible")}
              />

              <RadioCard
                title="Ollama (local server)"
                description={
                  isMobile
                    ? "Local server connections are disabled on mobile devices. Requires a desktop PC."
                    : "Run models locally via Ollama on http://localhost:11434 (free, private, text-only)"
                }
                monogram="🦙"
                tag={isMobile ? "PC ONLY" : "LOCAL SERVER"}
                checked={selectedProvider === "ollama"}
                onChange={() => handleProviderChange("ollama")}
                disabled={isMobile}
              />

              <RadioCard
                title="Local model (WebLLM)"
                description={
                  isMobile
                    ? "Local models are disabled on mobile devices (phones/tablets). Requires a desktop PC with WebGPU."
                    : "In-browser AI via WebGPU (free, private, text-only, requires PC)"
                }
                monogram="⚡"
                tag={isMobile ? "PC ONLY" : "KEYLESS"}
                checked={selectedProvider === "webllm"}
                onChange={() => handleProviderChange("webllm")}
                disabled={isMobile}
              />

              <RadioCard
                title="Anthropic (Claude)"
                description="Claude 3.5 Sonnet or Haiku via direct browser Messages API"
                monogram="C"
                checked={selectedProvider === "anthropic"}
                onChange={() => handleProviderChange("anthropic")}
              />

              <RadioCard
                title="Hugging Face"
                description="Serverless inference for Llama 3.2, Qwen 2.5, or Mistral with your HF token"
                monogram="🤗"
                checked={selectedProvider === "huggingface"}
                onChange={() => handleProviderChange("huggingface")}
              />
            </div>

            {isMobile && (
              <div style={{ marginTop: "var(--space-3)" }}>
                <Callout variant="warning" title="Local mode blocked on phones">
                  Local models are disabled on mobile devices (phones/tablets). Local mode runs only
                  on desktop computers with a dedicated GPU (FR-022, ADR-013). Please choose a cloud
                  provider (Gemini or OpenAI) or refer to the key guide.
                </Callout>
              </div>
            )}

            <div className="abh-guide-link-wrap">
              <a href="/guide/keys" className="abh-guide-link" target="_blank" rel="noreferrer">
                Need help getting a key? Read the key guide →
              </a>
            </div>
          </section>

          {/* Right Column: Configuration & Test Panel */}
          <section className="abh-setup-col-right" aria-label="Provider configuration">
            {selectedProvider === "webllm" || (selectedProvider === "ollama" && isMobile) ? (
              isMobile ? (
                <div className="abh-panel">
                  <Callout variant="danger" title="Local model unavailable on mobile devices">
                    Local models and local servers are disabled on mobile devices (phones/tablets).
                    Local mode runs only on desktop computers (FR-022, ADR-013). Please select a
                    cloud provider.
                  </Callout>
                </div>
              ) : (
                <div className="abh-panel">
                  <div className="abh-panel-header">
                    <span className="abh-panel-monogram" aria-hidden="true">
                      ⚡
                    </span>
                    <div>
                      <h2 className="abh-panel-title">In-Browser Local Model (WebLLM)</h2>
                      <p className="abh-panel-helper">
                        Zero API key required. Runs 100% locally on your computer via WebGPU.
                      </p>
                    </div>
                  </div>

                  <div className="abh-status-callout">
                    <Callout variant="info" title="Text-Only Interview Mode">
                      Local mode runs text-only interviews (ADR-013, FR-022). Speech and voice
                      recognition are disabled to dedicate device compute to the language model.
                    </Callout>
                  </div>

                  {onNavigateModelManager && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <Button variant="secondary" onClick={onNavigateModelManager}>
                        Manage & Download Models (Model Manager) →
                      </Button>
                    </div>
                  )}

                  <div className="abh-actions-row" style={{ marginTop: "var(--space-4)" }}>
                    <Button
                      variant="primary"
                      onClick={() => void handleTestConnection()}
                      disabled={testing}
                    >
                      {testing ? "Verifying local engine..." : "Verify local model"}
                    </Button>
                  </div>

                  {testError && (
                    <div className="abh-status-callout" role="alert">
                      <Callout variant="danger" title="Local Engine Error">
                        {testError.message}
                      </Callout>
                    </div>
                  )}

                  {testSuccess && (
                    <div className="abh-status-callout">
                      <Callout variant="success" title="Local model verified">
                        In-browser WebGPU engine is verified and ready for offline interviews.
                      </Callout>

                      {models.length > 0 && (
                        <div className="abh-form-field" style={{ marginTop: "var(--space-4)" }}>
                          <label htmlFor="model-picker-select" className="abh-label">
                            Choose Local Model
                          </label>
                          <select
                            id="model-picker-select"
                            className="abh-select"
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                          >
                            {models.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: "var(--space-4)" }}>
                    <HardwareBenchmarkCard runtime={hardwareRuntime} />
                  </div>
                </div>
              )
            ) : (
              <div className="abh-panel">
                <div className="abh-panel-header">
                  <span className="abh-panel-monogram" aria-hidden="true">
                    {selectedProvider === "gemini"
                      ? "G"
                      : selectedProvider === "ollama"
                        ? "🦙"
                        : selectedProvider === "anthropic"
                          ? "C"
                          : selectedProvider === "huggingface"
                            ? "🤗"
                            : "O"}
                  </span>
                  <div>
                    <h2 className="abh-panel-title">
                      {selectedProvider === "gemini"
                        ? "Google Gemini Setup"
                        : selectedProvider === "openai"
                          ? "OpenAI API Setup"
                          : selectedProvider === "ollama"
                            ? "Ollama Local Server"
                            : selectedProvider === "anthropic"
                              ? "Anthropic Claude API Setup"
                              : selectedProvider === "huggingface"
                                ? "Hugging Face Serverless Inference"
                                : "OpenAI-Compatible Endpoint"}
                    </h2>
                    <p className="abh-panel-helper">
                      {selectedProvider === "ollama"
                        ? "Direct browser connection to your local Ollama daemon (http://localhost:11434). Zero cloud egress."
                        : selectedProvider === "anthropic"
                          ? "Direct browser connection to Anthropic Messages API with danger header. Zero intermediary servers."
                          : selectedProvider === "huggingface"
                            ? "Direct browser connection to Hugging Face serverless inference. Zero intermediary servers."
                            : "Direct browser connection using your own API key."}
                    </p>
                  </div>
                </div>

                {(selectedProvider === "openai-compatible" ||
                  selectedProvider === "ollama" ||
                  selectedProvider === "huggingface") && (
                  <div className="abh-form-field">
                    <Input
                      label={
                        selectedProvider === "ollama"
                          ? "Ollama Base URL"
                          : selectedProvider === "huggingface"
                            ? "Hugging Face Inference URL"
                            : "Endpoint Base URL"
                      }
                      value={baseUrl}
                      onChange={(e) => {
                        setBaseUrl(e.target.value);
                        setTestSuccess(false);
                      }}
                      placeholder={
                        selectedProvider === "ollama"
                          ? "http://localhost:11434"
                          : selectedProvider === "huggingface"
                            ? "https://api-inference.huggingface.co/v1"
                            : "https://api.groq.com/openai/v1"
                      }
                      helperText={
                        selectedProvider === "ollama"
                          ? "Default is http://localhost:11434. Requires Ollama running on your PC."
                          : selectedProvider === "huggingface"
                            ? "Default is https://api-inference.huggingface.co/v1. You can also use https://router.huggingface.co/hf-inference/v1."
                            : "Must be an HTTPS endpoint (or http://localhost for local servers)."
                      }
                    />
                  </div>
                )}

                {selectedProvider === "ollama" && (
                  <div className="abh-status-callout">
                    <Callout variant="info" title="Browser CORS Requirement">
                      Browsers enforce cross-origin restrictions on localhost. If the test fails,
                      ensure Ollama was started with <code>OLLAMA_ORIGINS=&quot;*&quot;</code>. See
                      the{" "}
                      <a
                        href="/guide/local-models"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent-text)", textDecoration: "underline" }}
                      >
                        Local Models Guide
                      </a>{" "}
                      for setup commands.
                    </Callout>
                  </div>
                )}

                {selectedProvider !== "ollama" && (
                  <>
                    <SecretInput
                      label={selectedProvider === "huggingface" ? "User Access Token" : "API Key"}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setTestSuccess(false);
                      }}
                      placeholder={
                        selectedProvider === "gemini"
                          ? "AIzaSy..."
                          : selectedProvider === "anthropic"
                            ? "sk-ant-..."
                            : selectedProvider === "huggingface"
                              ? "hf_..."
                              : "sk-..."
                      }
                      helperText={
                        selectedProvider === "huggingface"
                          ? "Hugging Face User Access Token with read permissions (hf_...)."
                          : selectedProvider === "anthropic"
                            ? "Anthropic Claude API Key (sk-ant-...). Sent directly to api.anthropic.com."
                            : baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")
                              ? "Optional for local servers (LM Studio, LocalAI)."
                              : "Stays in this browser. Sent only to the provider you choose."
                      }
                    />

                    <div className="abh-encryption-toggle">
                      <Switch
                        label="Encrypt key at rest with a passphrase"
                        checked={usePassphrase}
                        onChange={(checked) => setUsePassphrase(checked)}
                      />
                    </div>

                    {usePassphrase && (
                      <div className="abh-passphrase-field">
                        <SecretInput
                          label="Passphrase for Key Encryption"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          placeholder="Enter passphrase to encrypt key"
                          helperText="Uses WebCrypto PBKDF2 + AES-GCM 256. Decrypted key is kept only in memory."
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="abh-actions-row">
                  <Button
                    variant="primary"
                    onClick={() => void handleTestConnection()}
                    disabled={
                      testing ||
                      (!apiKey.trim() &&
                        selectedProvider !== "ollama" &&
                        !baseUrl.includes("localhost") &&
                        !baseUrl.includes("127.0.0.1"))
                    }
                  >
                    {testing
                      ? "Testing connection..."
                      : selectedProvider === "ollama"
                        ? "Test Ollama connection"
                        : "Test connection"}
                  </Button>

                  {selectedProvider === "ollama" ? (
                    <a
                      href="/guide/local-models"
                      target="_blank"
                      rel="noreferrer"
                      className="abh-free-key-link"
                    >
                      Read Ollama setup guide ↗
                    </a>
                  ) : (
                    <a
                      href={
                        selectedProvider === "gemini"
                          ? "https://aistudio.google.com/app/apikey"
                          : "https://platform.openai.com/api-keys"
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="abh-free-key-link"
                    >
                      Get a free API key ↗
                    </a>
                  )}
                </div>

                {/* Error Callout */}
                {testError && (
                  <div className="abh-status-callout" role="alert">
                    <Callout
                      variant="danger"
                      title={
                        testError.kind === "auth"
                          ? "Authentication Failed"
                          : testError.kind === "quota"
                            ? "Quota or Rate Limit Exceeded"
                            : testError.kind === "cors"
                              ? "CORS Restriction Blocked Access"
                              : testError.kind === "model_not_found"
                                ? "Model Not Found"
                                : "Connection Failed"
                      }
                    >
                      {testError.message}
                    </Callout>
                  </div>
                )}

                {/* Success Callout & Model Picker */}
                {testSuccess && (
                  <div className="abh-status-callout">
                    <Callout variant="success" title="Connection verified">
                      Successfully connected to {selectedProvider}. Direct browser requests are
                      ready.
                    </Callout>

                    <div className="abh-form-field" style={{ marginTop: "var(--space-4)" }}>
                      <label htmlFor="model-picker-select" className="abh-label">
                        Choose Model
                      </label>
                      <select
                        id="model-picker-select"
                        className="abh-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {costEstimate && (
                      <div className="abh-cost-preview">
                        <span className="abh-cost-title">
                          ESTIMATED COST (10-QUESTION SESSION):
                        </span>
                        <span className="abh-cost-value">
                          {costEstimate.estimatedCostMinUsd > 0
                            ? `~$${costEstimate.estimatedCostMinUsd.toFixed(4)} - $${costEstimate.estimatedCostMaxUsd.toFixed(4)} USD`
                            : "Free / Included in Tier"}
                        </span>
                        <p className="abh-cost-note">
                          ~{costEstimate.estimatedTotalTokens.toLocaleString()} tokens expected.
                          Session hard cap enforced automatically (FR-032).
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="abh-divider-wrap" aria-hidden="true">
                  <span className="abh-divider-line" />
                  <span className="abh-divider-text">OR</span>
                  <span className="abh-divider-line" />
                </div>

                <div className="abh-local-model-section">
                  <Switch
                    label="Use a local model (PC only)"
                    checked={useLocalModel}
                    onChange={(checked) => setUseLocalModel(checked)}
                  />
                  <p className="abh-local-helper">
                    Runs WebGPU in browser. Requires a capable PC with dedicated GPU (text-only).
                  </p>
                  {useLocalModel && <HardwareBenchmarkCard runtime={hardwareRuntime} />}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="abh-setup-footer">
        <div className="abh-setup-footer-inner">
          <div className="abh-footer-status">
            <span
              className={`abh-status-indicator ${
                testSuccess
                  ? "abh-status-indicator--success"
                  : testing
                    ? "abh-status-indicator--loading"
                    : ""
              }`}
              aria-hidden="true"
            />
            <span className="abh-footer-status-text">
              {testing
                ? "Testing connection..."
                : testSuccess
                  ? `Connected: ${selectedModel}`
                  : "Not connected"}
            </span>
          </div>

          <Button
            variant="primary"
            onClick={() => void handleSaveAndContinue()}
            disabled={!testSuccess || saving}
          >
            {saving ? "Saving..." : "Next: add your profile"}
          </Button>
        </div>
      </footer>
    </div>
  );
};
