// FR-022, FR-023, FR-024, ADR-013, ADR-017, PG-19: Model Manager Screen.
// Manages in-browser models, download progress, pause and resume, storage meter,
import { useCallback, useEffect, useState } from "react";
import {
  detectHardwareCapabilities,
  formatBytes,
  runHardwareBenchmark,
  validateModelFormat,
  type BenchmarkResult,
  type HardwareCapabilityReport,
  type HardwareRuntime,
  type ModelFormatValidation,
  type ModelRow,
  type StorageAdapter,
  type StorageQuotaReport,
} from "@abhyas/core";
import { CURATED_MODELS, type CuratedModel } from "@abhyas/content";
import { Button, Callout, Dialog, Progress, Skeleton, Input } from "../components";
import {
  getInstalledModels,
  getLocalEngineAdapter,
  getStorageQuotaReport,
  recordModelStatus,
  removeModelRecord,
  requestPersistentStorage,
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
  const [customIdentifier, setCustomIdentifier] = useState("");
  const [customPreflight, setCustomPreflight] = useState<ModelFormatValidation | null>(null);

  // Dialog & notifications
  const [deleteModelTarget, setDeleteModelTarget] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const handleDownloadModel = async (model: CuratedModel | { id: string; sizeBytes: number }) => {
    setErrorMessage(null);
    setDownloadingId(model.id);
    setPausedId(null);
    setDownloadProgress(0);
    setDownloadStatusText("Initializing download...");

    await recordModelStatus(storage, model.id, "downloading", model.sizeBytes);

    try {
      const res = await engineAdapter.loadModel(model.id, (p) => {
        setDownloadProgress(p.percentage);
        setDownloadStatusText(p.text);
      });

      if (!res.ok) {
        setErrorMessage(res.error.message);
        await recordModelStatus(storage, model.id, "error", model.sizeBytes);
      } else {
        await recordModelStatus(storage, model.id, "ready", model.sizeBytes);
        setActiveModelId(model.id);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Model download failed.");
      await recordModelStatus(storage, model.id, "error", model.sizeBytes);
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

  const handleCustomIdentifierChange = (value: string) => {
    setCustomIdentifier(value);
    if (!value.trim()) {
      setCustomPreflight(null);
      return;
    }
    const validation = validateModelFormat(value);
    setCustomPreflight(validation);
  };

  const handleAddCustomModel = async () => {
    if (!customPreflight?.valid) return;
    const cleanId = customIdentifier.trim();
    await handleDownloadModel({ id: cleanId, sizeBytes: 1_500_000_000 });
    setCustomIdentifier("");
    setCustomPreflight(null);
  };

  const isModelReady = (id: string) =>
    installedModels.some((m) => m.id === id && m.status === "ready");

  const isModelPaused = (id: string) =>
    pausedId === id || installedModels.some((m) => m.id === id && m.status === "paused");

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
            <Callout variant="danger" title="WebGPU Unavailable">
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
                                  <Button
                                    variant="secondary"
                                    onClick={() => void handleUnloadModel()}
                                  >
                                    Unload (Free Memory)
                                  </Button>
                                )}
                                <Button
                                  variant="danger"
                                  onClick={() => setDeleteModelTarget(model.id)}
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
                        return (
                          <tr key={model.id}>
                            <td>
                              <strong>{model.name}</strong>
                              <div className="abh-mm-table-sub">{model.repository}</div>
                            </td>
                            <td>{model.minimumTier}</td>
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
                                    <Button
                                      variant="ghost"
                                      onClick={() => void handleUnloadModel()}
                                    >
                                      Unload
                                    </Button>
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
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
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
                  <div className="abh-form-field">
                    <Input
                      label="Model Repository Identifier or File Path"
                      value={customIdentifier}
                      onChange={(e) => handleCustomIdentifierChange(e.target.value)}
                      placeholder="e.g. org/repo-safetensors or local-model.gguf"
                      helperText="Must specify a safe format: .safetensors, .gguf, or .onnx."
                    />
                  </div>

                  {customPreflight && (
                    <div className="abh-mm-preflight-status">
                      {customPreflight.valid ? (
                        <Callout variant="success" title="Pre-flight Passed">
                          Format verified: safe <code>.{customPreflight.format}</code> format.
                          Custom models are unverified by Abhyas.
                        </Callout>
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
                      Pre-flight & Download Custom Model
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
