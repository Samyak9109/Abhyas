import React, { useEffect, useRef, useState } from "react";
import {
  buildExport,
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  loadSubtitleSettings,
  loadVoiceSettings,
  saveSubtitleSettings,
  saveVoiceSettings,
  executeImport,
  validateImport,
  type ImportValidationReport,
  type ProviderRow,
  type StorageAdapter,
  type SubtitleSettings,
  type SubtitleSize,
  type ThemePreference,
  type VoiceSettings,
} from "@abhyas/core";
import { Banner, Button, Callout, Dialog, Input, RadioCard, Switch, Toast } from "../components";
import type { StorageMode } from "../services/storage";

const DELETE_PHRASE = "DELETE";

const THEME_OPTIONS: {
  id: ThemePreference;
  title: string;
  description: string;
  monogram: string;
}[] = [
  { id: "system", title: "System", description: "Match your device appearance", monogram: "◐" },
  { id: "ink", title: "Ink", description: "Dark theme, the default Abhyas look", monogram: "●" },
  { id: "paper", title: "Paper", description: "Light theme for bright rooms", monogram: "○" },
];

const SPEECH_RATES: {
  rate: number;
  label: string;
  description: string;
  monogram: string;
}[] = [
  {
    rate: 0.8,
    label: "0.8x Slow",
    description: "Relaxed pacing for deliberate practice",
    monogram: "🐢",
  },
  {
    rate: 1.0,
    label: "1.0x Normal",
    description: "Natural conversational interview speed",
    monogram: "🎯",
  },
  {
    rate: 1.2,
    label: "1.2x Fast",
    description: "Crisp faster pace to practice under time pressure",
    monogram: "⚡",
  },
];

const SUBTITLE_SIZES: {
  id: SubtitleSize;
  title: string;
  description: string;
  monogram: string;
}[] = [
  {
    id: "S",
    title: "Small",
    description: "Compact size (13px) to maximize screen area",
    monogram: "S",
  },
  {
    id: "M",
    title: "Medium",
    description: "Standard balanced size (15px) for reading",
    monogram: "M",
  },
  { id: "L", title: "Large", description: "Prominent readable size (18px)", monogram: "L" },
];

interface SettingsScreenProps {
  storage: StorageAdapter;
  mode: StorageMode;
  quotaExceeded: boolean;
  themePreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
  onWriteError: (error: unknown) => void;
  onDataDeleted: () => void;
  onNavigateAISetup?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function exportFileName(): string {
  return `abhyas-export-${new Date().toISOString().slice(0, 10)}.json`;
}

function downloadJson(data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exportFileName();
  anchor.click();
  URL.revokeObjectURL(url);
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  storage,
  mode,
  quotaExceeded,
  themePreference,
  onThemeChange,
  onWriteError,
  onDataDeleted,
  onNavigateAISetup,
}) => {
  const [activeProvider, setActiveProvider] = useState<ProviderRow | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<ImportValidationReport | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeGroupRef = useRef<HTMLDivElement>(null);

  // Voice & Subtitle settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [subtitleSettings, setSubtitleSettings] =
    useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    let cancelled = false;
    void navigator.storage.estimate().then((estimate) => {
      if (!cancelled && estimate.usage !== undefined && estimate.quota !== undefined) {
        setUsage({ usage: estimate.usage, quota: estimate.quota });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = (await storage.getAll("providers")) as ProviderRow[];
        if (!cancelled && rows.length > 0) {
          setActiveProvider(rows[0] || null);
        } else if (!cancelled) {
          setActiveProvider(null);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Load voice & subtitle settings
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [v, s] = await Promise.all([
          loadVoiceSettings(storage),
          loadSubtitleSettings(storage),
        ]);
        if (!cancelled) {
          setVoiceSettings(v);
          setSubtitleSettings(s);
        }
      } catch {
        // fallback to defaults
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleVoiceToggle = async (enabled: boolean) => {
    const updated: VoiceSettings = { ...voiceSettings, enabled, autoPlay: enabled };
    setVoiceSettings(updated);
    try {
      await saveVoiceSettings(storage, updated);
      setToast(enabled ? "Question speech enabled." : "Question speech disabled.");
    } catch (error) {
      onWriteError(error);
      setActionError("Failed to save voice settings.");
    }
  };

  const handleRateChange = async (rate: number) => {
    const updated: VoiceSettings = { ...voiceSettings, rate };
    setVoiceSettings(updated);
    try {
      await saveVoiceSettings(storage, updated);
    } catch (error) {
      onWriteError(error);
      setActionError("Failed to save speech rate.");
    }
  };

  const handleSubtitlesToggle = async (enabled: boolean) => {
    const updated: SubtitleSettings = { ...subtitleSettings, enabled };
    setSubtitleSettings(updated);
    try {
      await saveSubtitleSettings(storage, updated);
      setToast(enabled ? "Live subtitles enabled." : "Live subtitles disabled.");
    } catch (error) {
      onWriteError(error);
      setActionError("Failed to save subtitle settings.");
    }
  };

  const handleSubtitleSizeChange = async (size: SubtitleSize) => {
    const updated: SubtitleSettings = { ...subtitleSettings, size };
    setSubtitleSettings(updated);
    try {
      await saveSubtitleSettings(storage, updated);
    } catch (error) {
      onWriteError(error);
      setActionError("Failed to save subtitle size.");
    }
  };

  const handleHighContrastToggle = async (highContrast: boolean) => {
    const updated: SubtitleSettings = { ...subtitleSettings, highContrast };
    setSubtitleSettings(updated);
    try {
      await saveSubtitleSettings(storage, updated);
    } catch (error) {
      onWriteError(error);
      setActionError("Failed to save high contrast setting.");
    }
  };

  const handleRemoveProvider = async (id: string) => {
    try {
      await storage.delete("providers", id);
      setActiveProvider(null);
      setToast("Provider key removed from this browser.");
    } catch (error) {
      onWriteError(error);
      setActionError("Failed to remove provider key.");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setActionError(null);
    try {
      downloadJson(await buildExport(storage));
      setToast("Export downloaded. It contains no API keys.");
    } catch (error) {
      onWriteError(error);
      setActionError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  async function readFileAsText(file: File): Promise<string> {
    if (typeof file.text === "function") {
      try {
        return await file.text();
      } catch {
        // fallback
      }
    }
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || "");
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const text = await readFileAsText(file);
      const report = await validateImport(text, storage);
      if (!report.valid) {
        setImportError(report.errorMessage || "Invalid backup file format.");
      } else {
        setImportReport(report);
        setImportDialogOpen(true);
      }
    } catch {
      setImportError("Failed to read the backup file.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!importReport?.data) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await executeImport(storage, importReport.data);
      setImportDialogOpen(false);
      setImportReport(null);
      setToast(`Import completed: ${result.importedSessions} session(s) restored.`);
      if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage !== undefined && est.quota !== undefined) {
          setUsage({ usage: est.usage, quota: est.quota });
        }
      }
    } catch (error) {
      onWriteError(error);
      setImportError("Import failed during execution.");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      await storage.clearAll();
      setConfirmOpen(false);
      setConfirmText("");
      onDataDeleted();
      setToast("All data deleted from this browser.");
    } catch (error) {
      onWriteError(error);
      setActionError("Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleThemeKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(event.key)) return;
    const radios = themeGroupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    if (!radios || radios.length === 0) return;
    event.preventDefault();
    const current = Array.from(radios).indexOf(document.activeElement as HTMLElement);
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const next = (current + delta + radios.length) % radios.length;
    radios[next]?.focus();
  };

  return (
    <div className="abh-settings">
      <h1 className="abh-app-title">Settings</h1>

      {mode === "memory" && (
        <div className="abh-settings-banner">
          <Banner
            variant="warning"
            message="Browser storage is unavailable, so Abhyas is running in memory. Nothing will survive a reload — export your data often."
          />
        </div>
      )}
      {quotaExceeded && (
        <div className="abh-settings-banner">
          <Banner
            variant="danger"
            message="Browser storage is full. Export or delete data to keep practicing."
            action={
              <Button variant="ghost" onClick={() => void handleExport()}>
                Export now
              </Button>
            }
          />
        </div>
      )}

      <section className="abh-panel" aria-labelledby="abh-settings-providers">
        <h2 id="abh-settings-providers" className="abh-panel-title">
          Providers and keys
        </h2>
        <p className="abh-panel-helper">
          Bring your own API key. Keys are sent only to the provider you choose.
        </p>

        {activeProvider ? (
          <div className="abh-data-row">
            <div>
              <p className="abh-data-label">Active Provider</p>
              <p className="abh-data-value">
                {activeProvider.kind === "gemini"
                  ? "Google Gemini"
                  : activeProvider.kind === "openai"
                    ? "OpenAI"
                    : "OpenAI-Compatible"}
                {" · "}
                {activeProvider.modelRoles?.interviewer || "Default model"}
              </p>
              <p className="abh-data-label" style={{ marginTop: "var(--space-2)" }}>
                Key Status
              </p>
              <p className="abh-data-value">
                {activeProvider.encryptedKey
                  ? "Encrypted at rest (passphrase required)"
                  : activeProvider.key
                    ? "Stored unencrypted in local browser storage"
                    : "No key saved"}
                {activeProvider.lastTestedAt && (
                  <span style={{ color: "var(--text-muted)", fontSize: "12px", display: "block" }}>
                    Last verified: {new Date(activeProvider.lastTestedAt).toLocaleDateString()}
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {onNavigateAISetup && (
                <Button variant="secondary" onClick={onNavigateAISetup}>
                  Change provider
                </Button>
              )}
              <Button variant="danger" onClick={() => void handleRemoveProvider(activeProvider.id)}>
                Remove key
              </Button>
            </div>
          </div>
        ) : (
          <div className="abh-data-row">
            <div>
              <p className="abh-data-label">Status</p>
              <p className="abh-data-value">No AI provider configured yet.</p>
            </div>
            {onNavigateAISetup && (
              <Button variant="primary" onClick={onNavigateAISetup}>
                Configure AI source
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="abh-panel" aria-labelledby="abh-settings-appearance">
        <h2 id="abh-settings-appearance" className="abh-panel-title">
          Appearance
        </h2>
        <p className="abh-panel-helper">Pick a theme, or follow your device.</p>
        <div
          ref={themeGroupRef}
          className="abh-theme-grid"
          role="radiogroup"
          aria-label="Theme"
          onKeyDown={handleThemeKeys}
        >
          {THEME_OPTIONS.map((option) => (
            <RadioCard
              key={option.id}
              title={option.title}
              description={option.description}
              monogram={option.monogram}
              checked={themePreference === option.id}
              onChange={() => onThemeChange(option.id)}
            />
          ))}
        </div>
      </section>

      {/* Voice & Subtitles Section (PG-18, FR-009, FR-010, FR-021) */}
      <section className="abh-panel" aria-labelledby="abh-settings-voice">
        <h2 id="abh-settings-voice" className="abh-panel-title">
          Voice &amp; Subtitles
        </h2>
        <p className="abh-panel-helper">
          Configure spoken questions, speech rate, live subtitles, and speech privacy.
        </p>

        {/* Spoken questions toggle */}
        <div className="abh-data-row" style={{ alignItems: "center" }}>
          <div>
            <p className="abh-data-label">Spoken Questions</p>
            <p className="abh-data-value">
              Read interviewer questions aloud using speech synthesis.
            </p>
          </div>
          <Switch
            label="Speak Questions"
            checked={voiceSettings.enabled}
            onChange={(checked) => void handleVoiceToggle(checked)}
          />
        </div>

        {/* Speech rate picker */}
        {voiceSettings.enabled && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <p className="abh-data-label" style={{ marginBottom: "var(--space-2)" }}>
              Speech Playback Speed
            </p>
            <div className="abh-theme-grid" role="radiogroup" aria-label="Speech playback speed">
              {SPEECH_RATES.map((opt) => (
                <RadioCard
                  key={opt.rate}
                  title={opt.label}
                  description={opt.description}
                  monogram={opt.monogram}
                  checked={voiceSettings.rate === opt.rate}
                  onChange={() => void handleRateChange(opt.rate)}
                />
              ))}
            </div>
          </div>
        )}

        <hr className="abh-divider" style={{ margin: "var(--space-4) 0" }} />

        {/* Subtitles toggle */}
        <div className="abh-data-row" style={{ alignItems: "center" }}>
          <div>
            <p className="abh-data-label">Live Subtitles</p>
            <p className="abh-data-value">
              Display real-time subtitles for interviewer and candidate.
            </p>
          </div>
          <Switch
            label="Live Subtitles"
            checked={subtitleSettings.enabled}
            onChange={(checked) => void handleSubtitlesToggle(checked)}
          />
        </div>

        {/* Subtitle size and high contrast */}
        {subtitleSettings.enabled && (
          <>
            <div style={{ marginTop: "var(--space-3)" }}>
              <p className="abh-data-label" style={{ marginBottom: "var(--space-2)" }}>
                Subtitle Text Size
              </p>
              <div className="abh-theme-grid" role="radiogroup" aria-label="Subtitle text size">
                {SUBTITLE_SIZES.map((opt) => (
                  <RadioCard
                    key={opt.id}
                    title={opt.title}
                    description={opt.description}
                    monogram={opt.monogram}
                    checked={subtitleSettings.size === opt.id}
                    onChange={() => void handleSubtitleSizeChange(opt.id)}
                  />
                ))}
              </div>
            </div>

            <div
              className="abh-data-row"
              style={{ alignItems: "center", marginTop: "var(--space-3)" }}
            >
              <div>
                <p className="abh-data-label">High-Contrast Subtitles</p>
                <p className="abh-data-value">
                  Use solid high-contrast backgrounds with enhanced borders for subtitles.
                </p>
              </div>
              <Switch
                label="High Contrast"
                checked={subtitleSettings.highContrast}
                onChange={(checked) => void handleHighContrastToggle(checked)}
              />
            </div>
          </>
        )}

        {/* Voice Privacy Disclosure (FR-021) */}
        <div style={{ marginTop: "var(--space-4)" }}>
          <Callout variant="info" title="Voice Privacy & Web Speech API">
            Voice recognition uses your browser&apos;s native Web Speech API. Depending on your
            browser vendor (such as Google or Apple), audio may be sent to their cloud servers for
            transcription. Your AI provider API keys are never used for speech recognition, and no
            audio or transcripts are stored on any Abhyas servers.
          </Callout>
        </div>
      </section>

      <section className="abh-panel" aria-labelledby="abh-settings-data">
        <h2 id="abh-settings-data" className="abh-panel-title">
          Data
        </h2>
        <p className="abh-panel-helper">
          Everything lives in this browser. Your API keys are never included in exports.
        </p>

        <div className="abh-data-row">
          <div>
            <p className="abh-data-label">Storage used</p>
            <p className="abh-data-value">
              {usage
                ? `${formatBytes(usage.usage)} of ${formatBytes(usage.quota)}`
                : mode === "memory"
                  ? "In-memory only — nothing is persisted"
                  : "Estimate unavailable"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="secondary" isLoading={exporting} onClick={() => void handleExport()}>
              Export data
            </Button>
            <Button
              variant="secondary"
              isLoading={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              Import data
            </Button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            aria-label="Upload backup JSON file"
            onChange={(e) => void handleFileSelected(e)}
            style={{ display: "none" }}
          />
        </div>

        {importError && (
          <div style={{ marginTop: "var(--space-2)" }}>
            <Callout variant="danger" title="Import refused">
              {importError}
            </Callout>
          </div>
        )}

        {actionError && (
          <Callout variant="danger" title="Something went wrong">
            {actionError}
          </Callout>
        )}

        <div className="abh-data-row">
          <div>
            <p className="abh-data-label">Delete all data</p>
            <p className="abh-data-value">
              Erases your profile, sessions and settings from this browser. This cannot be undone.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete all…
          </Button>
        </div>
      </section>

      <Dialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete all data?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== DELETE_PHRASE}
              isLoading={deleting}
              onClick={() => void handleDeleteAll()}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p>
          This permanently erases everything Abhyas stores in this browser — profile, documents,
          sessions and settings. If you want a backup, export first.
        </p>
        <div className="abh-dialog-input">
          <Input
            label={`Type ${DELETE_PHRASE} to confirm`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && confirmText === DELETE_PHRASE && !deleting) {
                void handleDeleteAll();
              }
            }}
            autoComplete="off"
          />
        </div>
      </Dialog>

      <Dialog
        isOpen={importDialogOpen}
        onClose={() => {
          setImportDialogOpen(false);
          setImportReport(null);
        }}
        title="Import backup data?"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setImportDialogOpen(false);
                setImportReport(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={importing}
              onClick={() => void handleConfirmImport()}
            >
              Confirm &amp; merge
            </Button>
          </>
        }
      >
        <p className="abh-panel-helper">
          Review the backup contents below. Existing sessions with matching IDs will be updated; new
          sessions will be added.
        </p>
        {importReport && (
          <div
            style={{
              marginTop: "var(--space-3)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <div className="abh-data-row">
              <div>
                <p className="abh-data-label">Exported Date</p>
                <p className="abh-data-value">
                  {importReport.exportedAt
                    ? new Date(importReport.exportedAt).toLocaleString()
                    : "Unknown date"}
                </p>
              </div>
              <div>
                <p className="abh-data-label">Schema Version</p>
                <p className="abh-data-value">v{importReport.schemaVersion}</p>
              </div>
            </div>
            <div className="abh-data-row">
              <div>
                <p className="abh-data-label">Sessions</p>
                <p className="abh-data-value">
                  {importReport.summary.sessionsCount} session(s)
                  {importReport.conflicts.duplicateSessions > 0 &&
                    ` (${importReport.conflicts.newSessions} new, ${importReport.conflicts.duplicateSessions} update)`}
                </p>
              </div>
              <div>
                <p className="abh-data-label">Recorded Answers</p>
                <p className="abh-data-value">{importReport.summary.turnsCount} turn(s)</p>
              </div>
            </div>
            <div className="abh-data-row">
              <div>
                <p className="abh-data-label">Profile &amp; Documents</p>
                <p className="abh-data-value">
                  {importReport.summary.hasProfile
                    ? `Included (${importReport.summary.documentsCount} doc(s))`
                    : "None"}
                </p>
              </div>
              <div>
                <p className="abh-data-label">Settings</p>
                <p className="abh-data-value">
                  {importReport.summary.hasSettings ? "Included" : "None"}
                </p>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};
