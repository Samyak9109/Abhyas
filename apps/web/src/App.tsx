import { useCallback, useEffect, useState } from "react";
import type { StorageAdapter } from "@abhyas/core";
import { Button, Callout, Skeleton } from "./components";
import { AISetupScreen } from "./screens/AISetupScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SessionSetupScreen } from "./screens/SessionSetupScreen";
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

type AppRoute = "/app/settings" | "/app/setup/ai" | "/app/setup/profile" | "/app/setup/session";

function getInitialRoute(): AppRoute {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.includes("setup/session") || window.location.hash.includes("setup/session")) {
      return "/app/setup/session";
    }
    if (path.includes("setup/profile") || window.location.hash.includes("setup/profile")) {
      return "/app/setup/profile";
    }
    if (path.includes("setup/ai") || window.location.hash.includes("setup/ai")) {
      return "/app/setup/ai";
    }
  }
  return "/app/settings";
}

type InitState =
  | { status: "loading" }
  | { status: "error"; kind: "version_conflict" | "unknown" }
  | { status: "ready"; storage: StorageAdapter; mode: StorageMode };

export function App() {
  const [route, setRoute] = useState<AppRoute>(getInitialRoute);
  const [init, setInit] = useState<InitState>({ status: "loading" });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const navigateTo = useCallback((nextRoute: AppRoute) => {
    setRoute(nextRoute);
    if (typeof window !== "undefined" && window.location.pathname !== nextRoute) {
      try {
        window.history.pushState({}, "", nextRoute);
      } catch {
        // ignore navigation history failures in restricted environments
      }
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(getInitialRoute());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  if (route === "/app/setup/ai") {
    return (
      <div className="abh-app">
        <AISetupScreen
          storage={init.storage}
          onComplete={() => navigateTo("/app/setup/profile")}
          onNavigateSettings={() => navigateTo("/app/settings")}
        />
      </div>
    );
  }

  if (route === "/app/setup/profile") {
    return (
      <div className="abh-app">
        <ProfileScreen
          storage={init.storage}
          onComplete={() => navigateTo("/app/setup/session")}
          onBack={() => navigateTo("/app/setup/ai")}
          onNavigateSettings={() => navigateTo("/app/settings")}
        />
      </div>
    );
  }

  if (route === "/app/setup/session") {
    return (
      <div className="abh-app">
        <SessionSetupScreen
          storage={init.storage}
          onStart={() => navigateTo("/app/settings")}
          onBack={() => navigateTo("/app/setup/profile")}
          onNavigateAISetup={() => navigateTo("/app/setup/ai")}
          onNavigateSettings={() => navigateTo("/app/settings")}
        />
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
              <a
                className="abh-app-nav-item"
                href="/app/setup/ai"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/app/setup/ai");
                }}
              >
                AI Setup
              </a>
            </li>
            <li>
              <a
                className="abh-app-nav-item"
                href="/app/setup/profile"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/app/setup/profile");
                }}
              >
                Profile
              </a>
            </li>
            <li>
              <a
                className="abh-app-nav-item"
                href="/app/settings"
                aria-current="page"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/app/settings");
                }}
              >
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
          onNavigateAISetup={() => navigateTo("/app/setup/ai")}
        />
      </main>
    </div>
  );
}
