// FR-020, FR-030: Settings screen (PG-18, M1.1 scope: appearance + data tools).
// Providers, voice and privacy sections arrive with M1.2 and M1.6.
import React, { useEffect, useRef, useState } from "react";
import { buildExport, type StorageAdapter, type ThemePreference } from "@abhyas/core";
import { Banner, Button, Callout, Dialog, Input, RadioCard, Toast } from "../components";
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

interface SettingsScreenProps {
  storage: StorageAdapter;
  mode: StorageMode;
  quotaExceeded: boolean;
  themePreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
  onWriteError: (error: unknown) => void;
  onDataDeleted: () => void;
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
}) => {
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const themeGroupRef = useRef<HTMLDivElement>(null);

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
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

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

  // design.md 6.1: radio groups support arrow keys in addition to Tab.
  const handleThemeKeys = (event: React.KeyboardEvent) => {
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
          <Button variant="secondary" isLoading={exporting} onClick={() => void handleExport()}>
            Export data
          </Button>
        </div>

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

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
};
