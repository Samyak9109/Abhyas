import { useCallback, useEffect, useState } from "react";
import {
  selectQuestions,
  type StructuredProfile,
  type SelectedQuestion,
  type SessionPlan,
  type StorageAdapter,
} from "@abhyas/core";
import { Button, Callout, Skeleton } from "./components";
import { AISetupScreen } from "./screens/AISetupScreen";
import { LiveInterviewScreen } from "./screens/LiveInterviewScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SessionSetupScreen } from "./screens/SessionSetupScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { DEFAULT_QUESTION_BANK } from "./services/question-bank";
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

type AppRoute =
  | "/app/settings"
  | "/app/setup/ai"
  | "/app/setup/profile"
  | "/app/setup/session"
  | "/app/interview";

function getInitialRoute(): AppRoute {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path.includes("interview") || window.location.hash.includes("interview")) {
      return "/app/interview";
    }
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
  const [activeSession, setActiveSession] = useState<{
    plan: SessionPlan;
    questions: SelectedQuestion[];
  } | null>(null);

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

  const handleStartSession = useCallback(
    async (plan: SessionPlan) => {
      if (!storage) return;
      try {
        const structured = await storage.getAll<StructuredProfile>("structuredProfiles");
        const profile = structured[0] ?? null;
        const result = await selectQuestions({
          plan,
          bank: DEFAULT_QUESTION_BANK,
          profile,
        });
        setActiveSession({ plan, questions: result.questions });
        navigateTo("/app/interview");
      } catch (err) {
        console.error("Failed to select questions for session:", err);
      }
    },
    [storage, navigateTo]
  );

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
          onStart={(plan) => void handleStartSession(plan)}
          onBack={() => navigateTo("/app/setup/profile")}
          onNavigateAISetup={() => navigateTo("/app/setup/ai")}
          onNavigateSettings={() => navigateTo("/app/settings")}
        />
      </div>
    );
  }

  if (route === "/app/interview") {
    if (!activeSession) {
      return (
        <div className="abh-app">
          <main className="abh-app-main" style={{ padding: "var(--space-6)" }}>
            <Callout variant="info" title="No active interview session">
              Please configure your interview settings to begin a session.
            </Callout>
            <div style={{ marginTop: "var(--space-4)" }}>
              <Button variant="primary" onClick={() => navigateTo("/app/setup/session")}>
                Go to Session Setup
              </Button>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="abh-app">
        <LiveInterviewScreen
          storage={init.storage}
          plan={activeSession.plan}
          questions={activeSession.questions}
          onFinish={() => {
            setActiveSession(null);
            navigateTo("/app/settings");
          }}
          onExit={() => {
            setActiveSession(null);
            navigateTo("/app/setup/session");
          }}
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
                href="/app/setup/session"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo("/app/setup/session");
                }}
              >
                Session
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
