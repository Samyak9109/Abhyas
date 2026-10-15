// FR-005, FR-021, FR-032, PG-09: AI setup screen (Step 1 of 3).
// Connects an AI source with bring-your-own-key, direct browser calls,
// optional WebCrypto passphrase encryption, connection test with classified errors,
// model picker, and cost estimation.
import React, { useEffect, useState } from "react";
import {
  encryptApiKey,
  estimateSessionCost,
  GeminiAdapter,
  OpenAICompatibleAdapter,
  type ModelInfo,
  type ProviderError,
  type ProviderRow,
  type StorageAdapter,
} from "@abhyas/core";
import { Button, Callout, Input, RadioCard, SecretInput, Stepper, Switch } from "../components";

interface AISetupScreenProps {
  storage: StorageAdapter;
  onComplete: () => void;
  onNavigateSettings?: () => void;
  /** Optional custom fetch implementation for testing */
  fetchFn?: typeof fetch;
}

type ProviderChoice = "gemini" | "openai" | "openai-compatible";

const SETUP_STEPS = [
  { id: "ai", label: "AI Setup" },
  { id: "profile", label: "Profile" },
  { id: "start", label: "Start" },
];

export const AISetupScreen: React.FC<AISetupScreenProps> = ({
  storage,
  onComplete,
  onNavigateSettings,
  fetchFn,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderChoice>("gemini");
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
          existing.kind === "openai-compatible"
        ) {
          setSelectedProvider(existing.kind as ProviderChoice);
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
  }, [storage]);

  const handleProviderChange = (provider: ProviderChoice) => {
    setSelectedProvider(provider);
    setTestSuccess(false);
    setTestError(null);
    setModels([]);
    setSelectedModel("");
    if (provider === "gemini") {
      setBaseUrl("");
    } else if (provider === "openai") {
      setBaseUrl("https://api.openai.com/v1");
    } else {
      setBaseUrl("https://api.groq.com/openai/v1");
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
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
      } else {
        adapter = new OpenAICompatibleAdapter({
          id: selectedProvider,
          apiKey,
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
          (m) => m.id.includes("flash") || m.id.includes("4o-mini")
        );
        setSelectedModel(preferred?.id || modelsRes.value[0]!.id);
      } else {
        const fallbackModel = selectedProvider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini";
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
    if (!testSuccess || !apiKey.trim()) return;

    if (usePassphrase && !passphrase.trim()) {
      setTestError({
        kind: "auth",
        message: "Please enter a passphrase to encrypt your key at rest, or disable encryption.",
        retryable: false,
      });
      return;
    }

    setSaving(true);
    try {
      let storedKey: string | undefined = apiKey;
      let encryptedKey: string | undefined;

      if (usePassphrase) {
        encryptedKey = await encryptApiKey(apiKey, passphrase);
        storedKey = undefined;
      }

      const model =
        selectedModel || (selectedProvider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");

      const providerRow: ProviderRow = {
        id: selectedProvider,
        kind: selectedProvider,
        baseUrl: selectedProvider === "openai-compatible" ? baseUrl : undefined,
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
          <span className="abh-wordmark">Abhyas</span>
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
                title="More providers"
                description="Claude & Hugging Face coming later in Phase 7"
                monogram="⋯"
                checked={false}
                comingSoon={true}
              />
            </div>

            <div className="abh-guide-link-wrap">
              <a href="/guide/keys" className="abh-guide-link" target="_blank" rel="noreferrer">
                Need help getting a key? Read the key guide →
              </a>
            </div>
          </section>

          {/* Right Column: Configuration & Test Panel */}
          <section className="abh-setup-col-right" aria-label="Provider configuration">
            <div className="abh-panel">
              <div className="abh-panel-header">
                <span className="abh-panel-monogram" aria-hidden="true">
                  {selectedProvider === "gemini" ? "G" : selectedProvider === "openai" ? "O" : "⚡"}
                </span>
                <div>
                  <h2 className="abh-panel-title">
                    {selectedProvider === "gemini"
                      ? "Google Gemini Setup"
                      : selectedProvider === "openai"
                        ? "OpenAI API Setup"
                        : "OpenAI-Compatible Endpoint"}
                  </h2>
                  <p className="abh-panel-helper">
                    Direct browser connection using your own API key.
                  </p>
                </div>
              </div>

              {selectedProvider === "openai-compatible" && (
                <div className="abh-form-field">
                  <Input
                    label="Endpoint Base URL"
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setTestSuccess(false);
                    }}
                    placeholder="https://api.groq.com/openai/v1"
                    helperText="Must be an HTTPS endpoint (or http://localhost for local servers)."
                  />
                </div>
              )}

              <SecretInput
                label="API Key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestSuccess(false);
                }}
                placeholder={selectedProvider === "gemini" ? "AIzaSy..." : "sk-..."}
                helperText="Stays in this browser. Sent only to the provider you choose."
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

              <div className="abh-actions-row">
                <Button
                  variant="primary"
                  onClick={() => void handleTestConnection()}
                  disabled={testing || !apiKey.trim()}
                >
                  {testing ? "Testing connection..." : "Test connection"}
                </Button>

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
                    Successfully connected to {selectedProvider}. Direct browser requests are ready.
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
                      <span className="abh-cost-title">ESTIMATED COST (10-QUESTION SESSION):</span>
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
                {useLocalModel && (
                  <Callout variant="info" title="Local model mode (Phase 3)">
                    In-browser WebGPU model management arrives in Phase 3. For Phase 1 practice,
                    connect via Gemini or an OpenAI-compatible endpoint.
                  </Callout>
                )}
              </div>
            </div>
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
