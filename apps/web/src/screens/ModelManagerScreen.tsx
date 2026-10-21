// FR-022, FR-023, FR-024, ADR-013, ADR-017, PG-19: Model Manager Screen.
// Manages in-browser models, download progress, pause and resume, storage meter,
import { useCallback, useEffect, useState } from "react";
import {
  detectHardwareCapabilities,
  estimateHardwareFit,
  formatBytes,
  runHardwareBenchmark,
  validateCustomModel,
  OllamaAdapter,
  type BenchmarkResult,
  type CustomModelEngine,
  type HardwareCapabilityReport,
  type HardwareRuntime,
  type ModelFormatValidation,
  type ModelRow,
  type StorageAdapter,
  type StorageQuotaReport,
} from "@abhyas/core";
import { CURATED_MODELS, type CuratedModel } from "@abhyas/content";
import { Button, Callout, Dialog, Progress, Skeleton, Input, SecretInput } from "../components";
import {
  getInstalledModels,
  getLocalEngineAdapter,
  getStorageQuotaReport,
  recordModelStatus,
  removeModelRecord,
  requestPersistentStorage,
  runSanityTestOnLoadedModel,
  runSanityTestOnModel,
} from "../services/local-engine";

interface ModelManagerScreenProps {
  storage: StorageAdapter;
  onNavigateBack?: () => void;
  onNavigateAISetup?: () => void;
  hardwareRuntime?: HardwareRuntime;
}

export function ModelManagerScreen({
  storage,
  onNavigateBack,
  onNavigateAISetup,
  hardwareRuntime,
}: ModelManagerScreenProps) {
  const [loading, setLoading] = useState(true);
  const [hardwareReport, setHardwareReport] = useState<HardwareCapabilityReport | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [storageReport, setStorageReport] = useState<StorageQuotaReport | null>(null);
  const [installedModels, setInstalledModels] = useState<ModelRow[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  // Download & progress states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStatusText, setDownloadStatusText] = useState<string>("");
  const [pausedId, setPausedId] = useState<string | null>(null);

  // View mode: Cards vs accessible table
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Custom model pre-flight state (FR-023, ADR-017)
  const [customEngine, setCustomEngine] = useState<CustomModelEngine>("webllm");
  const [customIdentifier, setCustomIdentifier] = useState("");
  const [customGatedToken, setCustomGatedToken] = useState("");
  const [customEndpointUrl, setCustomEndpointUrl] = useState("http://localhost:11434");
  const [customPreflight, setCustomPreflight] = useState<ModelFormatValidation | null>(null);

  // Dialog & notifications
  const [deleteModelTarget, setDeleteModelTarget] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sanityTestingId, setSanityTestingId] = useState<string | null>(null);
  const [sanityStep, setSanityStep] = useState<string | null>(null);
  const [isPersistRequesting, setIsPersistRequesting] = useState(false);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );

  const engineAdapter = getLocalEngineAdapter();

  const refreshData = useCallback(async () => {
    try {
      const [hw, quota, installed] = await Promise.all([
        detectHardwareCapabilities(hardwareRuntime),
        getStorageQuotaReport(),
        getInstalledModels(storage),
      ]);
      setHardwareReport(hw);
      setStorageReport(quota);
      setInstalledModels(installed);

      if (hw.supported) {
        const bench = await runHardwareBenchmark(hardwareRuntime, { report: hw, durationMs: 200 });
        setBenchmark(bench);
      }

      if (engineAdapter.isModelLoaded()) {
        setActiveModelId(engineAdapter.getCurrentModelId() ?? null);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load hardware or model data."
      );
    } finally {
      setLoading(false);
    }
  }, [engineAdapter, hardwareRuntime, storage]);

  useEffect(() => {
    void refreshData();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshData]);

  const handleRequestPersistence = async () => {
    setIsPersistRequesting(true);
    try {
      const granted = await requestPersistentStorage();
      const updated = await getStorageQuotaReport();
      setStorageReport({ ...updated, persisted: granted });
    } catch {
      // ignore
    } finally {
      setIsPersistRequesting(false);
    }
  };

  const handleDownloadModel = async (
    model: CuratedModel | { id: string; sizeBytes: number },
    customOptions?: {
      engine?: string | undefined;
      isCustom?: boolean | undefined;
      format?: string | undefined;
      gatedToken?: string | undefined;
    }
  ) => {
    setErrorMessage(null);
    setDownloadingId(model.id);
    setPausedId(null);
    setDownloadProgress(0);
    setDownloadStatusText("Initializing download...");

    await recordModelStatus(storage, model.id, "downloading", model.sizeBytes, customOptions);

    try {
      const res = await engineAdapter.loadModel(model.id, (p) => {
        setDownloadProgress(p.percentage);
        setDownloadStatusText(p.text);
      });

      if (!res.ok) {
        setErrorMessage(res.error.message);
        await recordModelStatus(storage, model.id, "error", model.sizeBytes, customOptions);
      } else {
        await recordModelStatus(storage, model.id, "ready", model.sizeBytes, customOptions);
        setActiveModelId(model.id);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Model download failed.");
      await recordModelStatus(storage, model.id, "error", model.sizeBytes, customOptions);
    } finally {
      setDownloadingId(null);
      const updatedInstalled = await getInstalledModels(storage);
      setInstalledModels(updatedInstalled);
      const updatedQuota = await getStorageQuotaReport();
      setStorageReport(updatedQuota);
    }
  };

  const handlePauseDownload = async (modelId: string) => {
    setPausedId(modelId);
    setDownloadingId(null);
    setDownloadStatusText(`Download paused at ${downloadProgress}%`);
    await engineAdapter.pauseDownload(modelId);
    await recordModelStatus(storage, modelId, "paused");
    const updatedInstalled = await getInstalledModels(storage);
    setInstalledModels(updatedInstalled);
  };

  const handleResumeDownload = async (model: CuratedModel | { id: string; sizeBytes: number }) => {
    setPausedId(null);
    await handleDownloadModel(model);
  };

  const handleCancelDownload = async (modelId: string) => {
    engineAdapter.cancel();
    setDownloadingId(null);
    setPausedId(null);
    setDownloadProgress(0);
    setDownloadStatusText("");
    await engineAdapter.deleteModel(modelId);
    await removeModelRecord(storage, modelId);
    const updatedInstalled = await getInstalledModels(storage);
    setInstalledModels(updatedInstalled);
  };

  const handleLoadModel = async (modelId: string) => {
    setErrorMessage(null);
    try {
      const res = await engineAdapter.loadModel(modelId);
      if (res.ok) {
        setActiveModelId(modelId);
      } else {
        setErrorMessage(res.error.message);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load model into memory.");
    }
  };

  const handleUnloadModel = async () => {
    try {
      await engineAdapter.unloadModel();
      setActiveModelId(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to unload model.");
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    try {
      if (activeModelId === modelId) {
        await handleUnloadModel();
      }
      await engineAdapter.deleteModel(modelId);
      await removeModelRecord(storage, modelId);
      setDeleteModelTarget(null);
      const updatedInstalled = await getInstalledModels(storage);
      setInstalledModels(updatedInstalled);
      const updatedQuota = await getStorageQuotaReport();
      setStorageReport(updatedQuota);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete model.");
    }
  };

  const handleCustomEngineChange = (engine: CustomModelEngine) => {
    setCustomEngine(engine);
    if (customIdentifier.trim()) {
      setCustomPreflight(validateCustomModel(customIdentifier, engine));
    } else {
      setCustomPreflight(null);
    }
  };

  const handleCustomIdentifierChange = (value: string) => {
    setCustomIdentifier(value);
    if (!value.trim()) {
      setCustomPreflight(null);
      return;
    }
    const validation = validateCustomModel(value, customEngine);
    setCustomPreflight(validation);
  };

  const handleAddCustomModel = async () => {
    if (!customPreflight?.valid) return;
    const cleanId = customIdentifier.trim();
    if (customEngine === "ollama") {
      await recordModelStatus(storage, cleanId, "ready", 2_000_000_000, {
        engine: "ollama",
        isCustom: true,
        format: "gguf",
      });
      const updatedInstalled = await getInstalledModels(storage);
      setInstalledModels(updatedInstalled);
      setCustomIdentifier("");
      setCustomPreflight(null);
    } else {
      await handleDownloadModel(
        { id: cleanId, sizeBytes: 1_500_000_000 },
        {
          engine: "webllm",
          isCustom: true,
          format: customPreflight.format ?? undefined,
          gatedToken: customGatedToken.trim() || undefined,
        }
      );
      setCustomIdentifier("");
      setCustomPreflight(null);
      setCustomGatedToken("");
    }
  };

  const handleRunSanityTest = async (modelId: string) => {
    try {
      setSanityTestingId(modelId);
      setSanityStep("Starting sanity checks...");
      setErrorMessage(null);

      const targetRecord = installedModels.find((m) => m.id === modelId);
      const isOllama = targetRecord?.engine === "ollama";

      if (isOllama) {
        const ollama = new OllamaAdapter({
          baseUrl: customEndpointUrl || "http://localhost:11434",
          model: modelId,
        });
        await runSanityTestOnModel(ollama, modelId, storage, {
          deviceLabel: "Ollama Local Daemon",
          onStepChange: (step, status) => {
            if (step === "speed") {
              setSanityStep(
                status === "running" ? "Measuring inference speed..." : `Speed check ${status}`
              );
            } else if (step === "instructionFollowing") {
              setSanityStep(
                status === "running"
                  ? "Testing instruction adherence..."
                  : `Instruction check ${status}`
              );
            } else if (step === "jsonValidity") {
              setSanityStep(
                status === "running" ? "Verifying JSON schema format..." : `JSON check ${status}`
              );
            }
          },
        });
      } else {
        await runSanityTestOnLoadedModel(engineAdapter, modelId, storage, {
          deviceLabel: hardwareReport?.adapterInfo?.description || "In-browser WebGPU Device",
          onStepChange: (step, status) => {
            if (step === "speed") {
              setSanityStep(
                status === "running" ? "Measuring inference speed..." : `Speed check ${status}`
              );
            } else if (step === "instructionFollowing") {
              setSanityStep(
                status === "running"
                  ? "Testing instruction adherence..."
                  : `Instruction check ${status}`
              );
            } else if (step === "jsonValidity") {
              setSanityStep(
                status === "running" ? "Verifying JSON schema format..." : `JSON check ${status}`
              );
            }
          },
        });
      }

      const updated = await getInstalledModels(storage);
      setInstalledModels(updated);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sanity test failed.");
    } finally {
      setSanityTestingId(null);
      setSanityStep(null);
    }
  };

  const isModelReady = (id: string) =>
    installedModels.some((m) => m.id === id && m.status === "ready");

  const isModelPaused = (id: string) =>
    pausedId === id || installedModels.some((m) => m.id === id && m.status === "paused");

  const customModels = installedModels.filter((m) => !CURATED_MODELS.some((c) => c.id === m.id));

  const fitEstimate =
    customPreflight?.valid && customEngine === "webllm"
      ? estimateHardwareFit(1_500_000_000, hardwareReport?.deviceMemoryGb)
      : null;

  return (
    <div className="abh-model-manager-screen" data-testid="model-manager-screen">
      <div className="abh-mm-container">
        {/* Navigation & Header */}
        <header className="abh-mm-header">
          <div className="abh-mm-header-nav">
            {onNavigateBack && (
              <Button variant="ghost" onClick={onNavigateBack} aria-label="Go back">
                ← Back
              </Button>
            )}
            {onNavigateAISetup && (
              <Button variant="secondary" onClick={onNavigateAISetup}>
                Open AI Setup
              </Button>
            )}
          </div>

          <div className="abh-mm-title-row">
            <div>
              <h1 className="abh-mm-title">In-Browser Model Manager</h1>
              <p className="abh-mm-subtitle">
                Download and manage local AI models running 100% offline via WebGPU (FR-022,
                FR-023).
              </p>
            </div>

            <div className="abh-mm-view-toggle">
              <Button
                variant={viewMode === "cards" ? "primary" : "secondary"}
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
              >
                Card View
              </Button>
              <Button
                variant={viewMode === "table" ? "primary" : "secondary"}
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
              >
                Table View
              </Button>
            </div>
          </div>
        </header>

        {/* Global Notifications and State Banners */}
        {hardwareReport && !hardwareReport.supported && (
          <div className="abh-mm-alert" role="alert">
            <Callout
              variant="danger"
              title={hardwareReport.isMobile ? "Mobile Device Blocked" : "WebGPU Unavailable"}
            >
              {hardwareReport.unsupportedReason ??
                "Local models are disabled on this device. Please use Chrome 113+ on desktop or connect a Gemini/OpenAI cloud key."}
            </Callout>
          </div>
        )}

        {isOffline && (
          <div className="abh-mm-alert">
            <Callout variant="info" title="Offline Mode Active">
              You are currently offline. Installed models remain fully operational for private,
              text-only interviews with zero network calls.
            </Callout>
          </div>
        )}

        {storageReport?.isNearlyFull && (
          <div className="abh-mm-alert" role="alert">
            <Callout variant="warning" title="Browser Storage Nearly Full">
              Browser storage is at {storageReport.percentage}%. Download may fail or browser may
              evict cached files if storage space runs out.
            </Callout>
          </div>
        )}

        {storageReport && !storageReport.persisted && (
          <div className="abh-mm-alert">
            <Callout variant="info" title="Persistent Storage Recommended">
              Persistent storage is not granted. The browser might automatically evict model weights
              under low disk conditions.
              <div style={{ marginTop: "var(--space-2)" }}>
                <Button
                  variant="secondary"
                  onClick={() => void handleRequestPersistence()}
                  disabled={isPersistRequesting}
                >
                  {isPersistRequesting ? "Requesting..." : "Request Persistent Storage"}
                </Button>
              </div>
            </Callout>
          </div>
        )}

        {errorMessage && (
          <div className="abh-mm-alert" role="alert">
            <Callout variant="danger" title="Model Error">
              {errorMessage}
              <div style={{ marginTop: "var(--space-2)" }}>
                <Button variant="ghost" onClick={() => setErrorMessage(null)}>
                  Dismiss
                </Button>
              </div>
            </Callout>
          </div>
        )}

        {loading ? (
          <div className="abh-mm-loading-skeleton" aria-label="Loading model manager">
            <Skeleton height="140px" />
            <Skeleton height="200px" />
            <Skeleton height="200px" />
          </div>
        ) : (
          <>
            {/* Device Summary & Storage Meter Section */}
            <section
              className="abh-mm-metrics-grid"
              aria-label="Device capabilities and storage meter"
            >
              <div className="abh-mm-metric-card">
                <span className="abh-mm-metric-label">Device Benchmark</span>
                <div className="abh-mm-metric-value">
                  {benchmark ? `${benchmark.tokensPerSecond} tok/s` : "Assessing..."}
                </div>
                <div className="abh-mm-metric-sub">
                  {benchmark?.recommendedModelTierLabel ?? "Testing throughput"}
                </div>
                {benchmark?.notes && benchmark.notes.length > 0 && (
                  <p className="abh-mm-metric-note">{benchmark.notes[0]}</p>
                )}
              </div>

              <div className="abh-mm-metric-card">
                <div className="abh-mm-metric-header">
                  <span className="abh-mm-metric-label">Browser Storage Meter</span>
                  <span className="abh-mm-storage-pct">
                    {storageReport ? `${storageReport.percentage}%` : "0%"}
                  </span>
                </div>

                <div className="abh-mm-meter-track" aria-hidden="true">
                  <div
                    className={`abh-mm-meter-fill ${storageReport?.isNearlyFull ? "abh-mm-meter-fill--warn" : ""}`}
                    style={{ width: `${Math.min(100, storageReport?.percentage ?? 0)}%` }}
                  />
                </div>

                <div className="abh-mm-storage-details">
                  <span>
                    Used: {formatBytes(storageReport?.usageBytes ?? 0)} of{" "}
                    {formatBytes(storageReport?.quotaBytes ?? 0)}
                  </span>
                  <span>{installedModels.length} installed</span>
                </div>

                <div className="abh-mm-persist-badge">
                  {storageReport?.persisted ? (
                    <span className="abh-badge abh-badge--success">
                      Persistent Storage Granted ✓
                    </span>
                  ) : (
                    <span className="abh-badge abh-badge--neutral">Best-Effort Storage</span>
                  )}
                </div>
              </div>
            </section>

            {/* Curated Models Section */}
            <section className="abh-mm-section" aria-label="Curated in-browser models">
              <div className="abh-mm-section-header">
                <div>
                  <h2 className="abh-mm-section-title">Curated WebGPU Models</h2>
                  <p className="abh-mm-section-desc">
                    Vetted MLC models running directly in your browser with zero server latency or
                    fees.
                  </p>
                </div>
              </div>

              {viewMode === "cards" ? (
                <div className="abh-mm-cards-grid">
                  {CURATED_MODELS.map((model) => {
                    const ready = isModelReady(model.id);
                    const isDownloading = downloadingId === model.id;
                    const isPaused = isModelPaused(model.id);
                    const isActive = activeModelId === model.id;
                    const localRecord = installedModels.find((m) => m.id === model.id);
                    const localSanity = localRecord?.sanityResult;
                    const effectiveSanity = localSanity ?? model.sanityResult;
                    const isTestingSanity = sanityTestingId === model.id;
                    const isRecommended =
                      benchmark &&
                      ((benchmark.tier === "basic" && model.minimumTier === "basic") ||
                        (benchmark.tier === "standard" && model.minimumTier === "standard") ||
                        (benchmark.tier === "advanced" && model.minimumTier === "advanced"));

                    return (
                      <article
                        key={model.id}
                        className={`abh-mm-card ${isRecommended ? "abh-mm-card--recommended" : ""}`}
                        aria-labelledby={`model-title-${model.id}`}
                      >
                        <div className="abh-mm-card-header">
                          <div>
                            <div className="abh-mm-card-badges">
                              <span className="abh-badge abh-badge--tier">
                                {model.minimumTier.toUpperCase()}
                              </span>
                              {isRecommended && (
                                <span className="abh-badge abh-badge--highlight">
                                  RECOMMENDED FOR YOU
                                </span>
                              )}
                              <span
                                className={`abh-badge abh-badge--sanity-${effectiveSanity.status}`}
                                title={effectiveSanity.notes}
                              >
                                {effectiveSanity.status === "interview-ready"
                                  ? "INTERVIEW-READY"
                                  : effectiveSanity.status === "questions-only"
                                    ? "QUESTIONS ONLY"
                                    : "NOT SUITABLE"}
                                {localSanity ? " (LOCAL)" : " (VERIFIED)"}
                              </span>
                              {ready && (
                                <span className="abh-badge abh-badge--success">INSTALLED</span>
                              )}
                              {isActive && (
                                <span className="abh-badge abh-badge--active">LOADED IN RAM</span>
                              )}
                            </div>
                            <h3 id={`model-title-${model.id}`} className="abh-mm-card-title">
                              {model.name}
                            </h3>
                            <span className="abh-mm-card-repo">{model.repository}</span>
                          </div>

                          <div className="abh-mm-card-size">
                            <span>{formatBytes(model.sizeBytes)}</span>
                          </div>
                        </div>

                        <p className="abh-mm-card-notes">{model.notes}</p>

                        <div className="abh-mm-card-meta">
                          <span>Context: {model.contextLength} tokens</span>
                          <span>Format: {model.format}</span>
                          <span>
                            Speed:{" "}
                            {localSanity
                              ? `${localSanity.tokensPerSecond} tps (local)`
                              : `${model.measuredSpeed.tokensPerSecond} tps (${model.measuredSpeed.referenceDevice})`}
                          </span>
                        </div>

                        {/* Download Progress Bar */}
                        {isDownloading && (
                          <div className="abh-mm-progress-wrap">
                            <Progress value={downloadProgress} label={downloadStatusText} />
                            <div className="abh-mm-progress-actions">
                              <Button
                                variant="secondary"
                                onClick={() => void handlePauseDownload(model.id)}
                              >
                                Pause
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => void handleCancelDownload(model.id)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {isPaused && (
                          <div className="abh-mm-paused-wrap">
                            <span className="abh-mm-paused-text">
                              Paused ({downloadProgress || "partial"}%)
                            </span>
                            <div className="abh-mm-progress-actions">
                              <Button
                                variant="primary"
                                onClick={() => void handleResumeDownload(model)}
                              >
                                Resume Download
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => void handleCancelDownload(model.id)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Model Action Buttons */}
                        {!isDownloading && !isPaused && (
                          <div className="abh-mm-card-actions">
                            {!ready ? (
                              <Button
                                variant="primary"
                                onClick={() => void handleDownloadModel(model)}
                                disabled={Boolean(downloadingId) || !hardwareReport?.supported}
                              >
                                Download ({formatBytes(model.sizeBytes)})
                              </Button>
                            ) : (
                              <>
                                {!isActive ? (
                                  <Button
                                    variant="primary"
                                    onClick={() => void handleLoadModel(model.id)}
                                  >
                                    Load into Memory
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => void handleRunSanityTest(model.id)}
                                      disabled={Boolean(sanityTestingId)}
                                    >
                                      {isTestingSanity
                                        ? (sanityStep ?? "Testing Sanity...")
                                        : "Run Sanity Test"}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      onClick={() => void handleUnloadModel()}
                                      disabled={Boolean(sanityTestingId)}
                                    >
                                      Unload (Free Memory)
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="danger"
                                  onClick={() => setDeleteModelTarget(model.id)}
                                  disabled={Boolean(sanityTestingId)}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {customModels.length > 0 && (
                    <div style={{ gridColumn: "1 / -1", marginTop: "var(--space-6)" }}>
                      <h3
                        className="abh-mm-section-title"
                        style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}
                      >
                        Installed Custom Models ({customModels.length})
                      </h3>
                      <div className="abh-mm-cards-grid">
                        {customModels.map((model) => {
                          const ready = model.status === "ready";
                          const isActive = activeModelId === model.id;
                          const isTestingSanity = sanityTestingId === model.id;
                          const sanity = model.sanityResult;

                          return (
                            <article
                              key={model.id}
                              className={`abh-mm-card ${isActive ? "abh-mm-card--active" : ""}`}
                              aria-label={`${model.id} custom model`}
                            >
                              <div className="abh-mm-card-header">
                                <div className="abh-mm-card-title-row">
                                  <h3 className="abh-mm-card-title" title={model.id}>
                                    {model.id}
                                  </h3>
                                  <span
                                    className="abh-badge"
                                    style={{
                                      backgroundColor:
                                        "var(--amber-surface, rgba(234, 153, 0, 0.15))",
                                      color: "var(--amber-text, #ea9900)",
                                      border: "1px solid var(--amber-border, #ea9900)",
                                    }}
                                  >
                                    UNVERIFIED
                                  </span>
                                  <span className="abh-badge abh-badge--info">
                                    {model.engine.toUpperCase()}
                                  </span>
                                </div>
                                <p className="abh-mm-card-repo">
                                  Format: {model.format || "auto"} · Size:{" "}
                                  {formatBytes(model.sizeBytes)}
                                </p>
                              </div>

                              <div className="abh-mm-card-sanity">
                                <span className="abh-mm-metric-label">Sanity Status:</span>
                                {sanity ? (
                                  <span
                                    className={`abh-badge abh-badge--${
                                      sanity.status === "interview-ready"
                                        ? "success"
                                        : sanity.status === "questions-only"
                                          ? "warning"
                                          : "danger"
                                    }`}
                                  >
                                    {sanity.status.toUpperCase()} ({sanity.tokensPerSecond} tps)
                                  </span>
                                ) : (
                                  <span className="abh-badge abh-badge--neutral">NOT TESTED</span>
                                )}
                              </div>

                              <div className="abh-mm-card-actions">
                                {ready && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => void handleRunSanityTest(model.id)}
                                    disabled={Boolean(sanityTestingId)}
                                  >
                                    {isTestingSanity
                                      ? sanityStep || "Testing..."
                                      : "Run Sanity Test"}
                                  </Button>
                                )}
                                <Button
                                  variant="danger"
                                  onClick={() => setDeleteModelTarget(model.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Accessible Data Table Alternative */
                <div className="abh-mm-table-container">
                  <table
                    className="abh-mm-table"
                    aria-label="Curated in-browser models comparison and actions"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Model Name</th>
                        <th scope="col">Tier</th>
                        <th scope="col">Speed & Sanity</th>
                        <th scope="col">Size</th>
                        <th scope="col">Context</th>
                        <th scope="col">Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CURATED_MODELS.map((model) => {
                        const ready = isModelReady(model.id);
                        const isActive = activeModelId === model.id;
                        const localRecord = installedModels.find((m) => m.id === model.id);
                        const localSanity = localRecord?.sanityResult;
                        const effectiveSanity = localSanity ?? model.sanityResult;
                        const isTestingSanity = sanityTestingId === model.id;

                        return (
                          <tr key={model.id}>
                            <td>
                              <strong>{model.name}</strong>
                              <div className="abh-mm-table-sub">{model.repository}</div>
                            </td>
                            <td>{model.minimumTier}</td>
                            <td>
                              <div className="abh-mm-table-speed">
                                {localSanity
                                  ? `${localSanity.tokensPerSecond} tps (local)`
                                  : `${model.measuredSpeed.tokensPerSecond} tps (ref)`}
                              </div>
                              <span
                                className={`abh-badge abh-badge--sanity-${effectiveSanity.status}`}
                              >
                                {effectiveSanity.status === "interview-ready"
                                  ? "Interview Ready"
                                  : "Questions Only"}
                              </span>
                            </td>
                            <td>{formatBytes(model.sizeBytes)}</td>
                            <td>{model.contextLength}</td>
                            <td>
                              {isActive
                                ? "Loaded"
                                : ready
                                  ? "Installed"
                                  : downloadingId === model.id
                                    ? `Downloading ${downloadProgress}%`
                                    : "Not installed"}
                            </td>
                            <td>
                              {!ready ? (
                                <Button
                                  variant="secondary"
                                  onClick={() => void handleDownloadModel(model)}
                                  disabled={Boolean(downloadingId) || !hardwareReport?.supported}
                                >
                                  Download
                                </Button>
                              ) : (
                                <div className="abh-mm-table-actions">
                                  {isActive ? (
                                    <>
                                      <Button
                                        variant="secondary"
                                        onClick={() => void handleRunSanityTest(model.id)}
                                        disabled={Boolean(sanityTestingId)}
                                      >
                                        {isTestingSanity ? "Testing..." : "Sanity Test"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        onClick={() => void handleUnloadModel()}
                                        disabled={Boolean(sanityTestingId)}
                                      >
                                        Unload
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      onClick={() => void handleLoadModel(model.id)}
                                    >
                                      Load
                                    </Button>
                                  )}
                                  <Button
                                    variant="danger"
                                    onClick={() => setDeleteModelTarget(model.id)}
                                    disabled={Boolean(sanityTestingId)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {customModels.map((model) => {
                        const ready = model.status === "ready";
                        const isTestingSanity = sanityTestingId === model.id;
                        const sanity = model.sanityResult;

                        return (
                          <tr key={`custom-${model.id}`}>
                            <th scope="row" className="abh-mm-table-model-cell">
                              <div>
                                <span className="abh-mm-table-model-name">{model.id}</span>
                                <span
                                  className="abh-badge"
                                  style={{
                                    marginLeft: "var(--space-2)",
                                    backgroundColor:
                                      "var(--amber-surface, rgba(234, 153, 0, 0.15))",
                                    color: "var(--amber-text, #ea9900)",
                                    border: "1px solid var(--amber-border, #ea9900)",
                                  }}
                                >
                                  UNVERIFIED
                                </span>
                              </div>
                            </th>
                            <td>
                              <span className="abh-badge abh-badge--info">
                                {model.engine.toUpperCase()}
                              </span>
                            </td>
                            <td>{formatBytes(model.sizeBytes)}</td>
                            <td>{model.format || "auto"}</td>
                            <td>—</td>
                            <td>
                              {sanity ? (
                                <span
                                  className={`abh-badge abh-badge--${
                                    sanity.status === "interview-ready"
                                      ? "success"
                                      : sanity.status === "questions-only"
                                        ? "warning"
                                        : "danger"
                                  }`}
                                >
                                  {sanity.status.toUpperCase()} ({sanity.tokensPerSecond} tps)
                                </span>
                              ) : (
                                <span className="abh-badge abh-badge--neutral">NOT TESTED</span>
                              )}
                            </td>
                            <td>
                              <div className="abh-mm-table-actions">
                                {ready && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => void handleRunSanityTest(model.id)}
                                    disabled={Boolean(sanityTestingId)}
                                  >
                                    {isTestingSanity ? "Testing..." : "Sanity Test"}
                                  </Button>
                                )}
                                <Button
                                  variant="danger"
                                  onClick={() => setDeleteModelTarget(model.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Custom Model Form (FR-023, ADR-017) */}
            <section className="abh-mm-section" aria-label="Add custom model">
              <div className="abh-mm-custom-card">
                <h2 className="abh-mm-section-title">Add Custom Model (Power Users)</h2>
                <p className="abh-mm-section-desc">
                  Load any compatible model repository. Safe formats allowlist: .safetensors, .gguf,
                  .onnx. Pickle-based files (.pkl, .bin, .pt) are strictly rejected to protect your
                  machine.
                </p>

                <div className="abh-mm-custom-form">
                  <fieldset
                    className="abh-form-fieldset"
                    style={{ border: "none", padding: 0, margin: "0 0 1rem 0" }}
                  >
                    <legend className="abh-label" style={{ marginBottom: "0.5rem" }}>
                      Target Engine
                    </legend>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="customEngine"
                          value="webllm"
                          checked={customEngine === "webllm"}
                          onChange={() => handleCustomEngineChange("webllm")}
                        />
                        <span>In-Browser WebGPU (WebLLM)</span>
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="radio"
                          name="customEngine"
                          value="ollama"
                          checked={customEngine === "ollama"}
                          onChange={() => handleCustomEngineChange("ollama")}
                        />
                        <span>Local Daemon (Ollama)</span>
                      </label>
                    </div>
                  </fieldset>

                  <div className="abh-form-field">
                    <Input
                      label={
                        customEngine === "ollama"
                          ? "Ollama Model Tag"
                          : "Model Repository Identifier or File Path"
                      }
                      value={customIdentifier}
                      onChange={(e) => handleCustomIdentifierChange(e.target.value)}
                      placeholder={
                        customEngine === "ollama"
                          ? "e.g. llama3.2:1b or mistral:latest"
                          : "e.g. org/repo-safetensors or local-model.gguf"
                      }
                      helperText={
                        customEngine === "ollama"
                          ? "Model tag registered in your local Ollama daemon."
                          : "Must specify a safe format: .safetensors, .gguf, or .onnx."
                      }
                    />
                  </div>

                  {customEngine === "ollama" && (
                    <div className="abh-form-field">
                      <Input
                        label="Ollama Server Endpoint"
                        value={customEndpointUrl}
                        onChange={(e) => setCustomEndpointUrl(e.target.value)}
                        placeholder="http://localhost:11434"
                        helperText="Base URL of your running Ollama instance."
                      />
                    </div>
                  )}

                  {customEngine === "webllm" && (
                    <div className="abh-form-field">
                      <SecretInput
                        label="Hugging Face Access Token (Optional)"
                        value={customGatedToken}
                        onChange={(e) => setCustomGatedToken(e.target.value)}
                        placeholder="hf_..."
                        helperText="Required only for private or gated Hugging Face repositories."
                      />
                    </div>
                  )}

                  {customPreflight && (
                    <div className="abh-mm-preflight-status">
                      {customPreflight.valid ? (
                        <>
                          <Callout variant="success" title="Pre-flight Passed">
                            Format verified: safe <code>.{customPreflight.format}</code> format.
                            Custom models are unverified by Abhyas.
                          </Callout>
                          {fitEstimate && (
                            <div style={{ marginTop: "0.5rem" }}>
                              <Callout
                                variant={
                                  fitEstimate.fit === "insufficient"
                                    ? "danger"
                                    : fitEstimate.fit === "tight"
                                      ? "warning"
                                      : "info"
                                }
                                title="Hardware Fit Estimate"
                              >
                                {fitEstimate.message}
                              </Callout>
                            </div>
                          )}
                        </>
                      ) : (
                        <Callout variant="danger" title="Format Rejected">
                          {customPreflight.error}
                        </Callout>
                      )}
                    </div>
                  )}

                  <div className="abh-mm-custom-actions">
                    <Button
                      variant="primary"
                      onClick={() => void handleAddCustomModel()}
                      disabled={!customPreflight?.valid || Boolean(downloadingId)}
                    >
                      {customEngine === "ollama"
                        ? "Register & Verify Ollama Model"
                        : "Pre-flight & Download Custom Model"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          isOpen={Boolean(deleteModelTarget)}
          onClose={() => setDeleteModelTarget(null)}
          title="Delete Model Weights?"
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleteModelTarget(null)}>
                Keep Model
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (deleteModelTarget) void handleDeleteModel(deleteModelTarget);
                }}
              >
                Delete Model
              </Button>
            </>
          }
        >
          <p>
            Are you sure you want to delete {deleteModelTarget}? This will delete the cached model
            files and free up disk storage.
          </p>
        </Dialog>
      </div>
    </div>
  );
}
