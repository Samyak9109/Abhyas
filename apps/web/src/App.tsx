// FR-001, FR-030: App shell with storage initialization, theme wiring and the
// M1.1 settings screen. The M0.2 component gallery is superseded by real screens;
// component coverage lives in components.test.tsx.
import { useCallback, useEffect, useState } from "react";
import type { StorageAdapter } from "@abhyas/core";
import { Button, Callout, Skeleton } from "./components";
import { SettingsScreen } from "./screens/SettingsScreen";
import {
  StorageOpenError,
  initStorage,
  isQuotaExceededError,
  type StorageMode,
} from "./services/storage";
import { applyResolvedTheme, loadThemePreference, mirrorThemePreference } from "./services/theme";
import { useTheme } from "./services/use-theme";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/app.css";

type InitState =
  | { status: "loading" }
  | { status: "error"; kind: "version_conflict" | "unknown" }
  | { status: "ready"; storage: StorageAdapter; mode: StorageMode };

export function App() {
  const [init, setInit] = useState<InitState>({ status: "loading" });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    initStorage()
      .then((appStorage) => {
        if (!cancelled) {
          setInit({ status: "ready", storage: appStorage.adapter, mode: appStorage.mode });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setInit({
          status: "error",
          kind: error instanceof StorageOpenError ? error.kind : "unknown",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const storage = init.status === "ready" ? init.storage : null;
  const { preference, setThemePreference } = useTheme(storage);

  const handleWriteError = useCallback((error: unknown) => {
    if (isQuotaExceededError(error)) setQuotaExceeded(true);
  }, []);

  // After delete-all the settings table is empty; reset the applied theme and
  // the pre-paint mirror to the default instead of leaving a stale preference.
  const handleDataDeleted = useCallback(() => {
    setQuotaExceeded(false);
    if (!storage) return;
    void loadThemePreference(storage).then((preference) => {
      applyResolvedTheme(preference);
      mirrorThemePreference(preference);
    });
  }, [storage]);

  if (init.status === "loading") {
    return (
      <div className="abh-app">
        <div className="abh-app-loading" aria-busy="true" aria-label="Loading Abhyas">
          <Skeleton height="40px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
        </div>
      </div>
    );
  }

  if (init.status === "error") {
    return (
      <div className="abh-app">
        <div className="abh-app-loading">
          <Callout
            variant="danger"
            title={
              init.kind === "version_conflict"
                ? "Abhyas was updated in another tab"
                : "Storage failed to open"
            }
          >
            {init.kind === "version_conflict"
              ? "This browser already has newer Abhyas data. Reload to continue with the new version."
              : "Your browser blocked local storage. Allow site data for this site, then retry."}
          </Callout>
          {init.kind === "version_conflict" ? (
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="abh-app">
      <aside className="abh-app-nav">
        <span className="abh-wordmark" aria-hidden="true">
          Abhyas
        </span>
        <nav aria-label="App">
          <ul className="abh-app-nav-list">
            <li>
              <a className="abh-app-nav-item" href="/app/settings" aria-current="page">
                Settings
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="abh-app-main">
        <SettingsScreen
          storage={init.storage}
          mode={init.mode}
          quotaExceeded={quotaExceeded}
          themePreference={preference}
          onThemeChange={(next) => void setThemePreference(next)}
          onWriteError={handleWriteError}
          onDataDeleted={handleDataDeleted}
        />
      </main>
    </div>
  );
}
