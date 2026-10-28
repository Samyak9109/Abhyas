import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  selectQuestions,
  type StructuredProfile,
  type SelectedQuestion,
  type SessionPlan,
  type StorageAdapter,
  type CompanyPack,
} from "@abhyas/core";
import { AbhyasLoader, Banner, BrandMark, Button, Callout, Skeleton } from "./components";
import { HomeScreen } from "./screens/HomeScreen";
import { DEFAULT_QUESTION_BANK } from "./services/question-bank";
import { loadCompanyPack } from "./services/company-pack-service";
import {
  StorageOpenError,
  initStorage,
  isQuotaExceededError,
  type StorageMode,
} from "./services/storage";
import { applyResolvedTheme, loadThemePreference, mirrorThemePreference } from "./services/theme";
import { useTheme } from "./services/use-theme";
import { registerPwa } from "./services/pwa";
import { getLocalEngineAdapter } from "./services/local-engine";
import "./styles/tokens.css";
import "./styles/preloader.css";
import "./styles/components.css";
import "./styles/app.css";
import "./styles/public.css";
import {
  LandingPage,
  PrivacyPage,
  OpenSourcePage,
  KeyGuidePage,
  LocalModelsGuidePage,
  RoadmapPage,
  TroubleshootingPage,
  NotFoundPage,
} from "./screens/public";

// Lazy-loaded screen modules to meet NFR-001 initial bundle budget (<300 KB gzipped)
const AISetupScreen = lazy(() =>
  import("./screens/AISetupScreen").then((m) => ({ default: m.AISetupScreen }))
);
const ProfileScreen = lazy(() =>
  import("./screens/ProfileScreen").then((m) => ({ default: m.ProfileScreen }))
);
const SessionSetupScreen = lazy(() =>
  import("./screens/SessionSetupScreen").then((m) => ({ default: m.SessionSetupScreen }))
);
const LiveInterviewScreen = lazy(() =>
  import("./screens/LiveInterviewScreen").then((m) => ({ default: m.LiveInterviewScreen }))
);
const ResultsScreen = lazy(() =>
  import("./screens/ResultsScreen").then((m) => ({ default: m.ResultsScreen }))
);
const SkillsDashboardScreen = lazy(() =>
  import("./screens/SkillsDashboardScreen").then((m) => ({ default: m.SkillsDashboardScreen }))
);
const SkillPracticeScreen = lazy(() =>
  import("./screens/SkillPracticeScreen").then((m) => ({ default: m.SkillPracticeScreen }))
);
const HistoryScreen = lazy(() =>
  import("./screens/HistoryScreen").then((m) => ({ default: m.HistoryScreen }))
);
const SettingsScreen = lazy(() =>
  import("./screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen }))
);
const ModelManagerScreen = lazy(() =>
  import("./screens/ModelManagerScreen").then((m) => ({ default: m.ModelManagerScreen }))
);
const CompanyDirectoryScreen = lazy(() =>
  import("./screens/CompanyDirectoryScreen").then((m) => ({ default: m.CompanyDirectoryScreen }))
);
const ScheduleScreen = lazy(() =>
  import("./screens/ScheduleScreen").then((m) => ({ default: m.ScheduleScreen }))
);
const ReviewQueueScreen = lazy(() =>
  import("./screens/ReviewQueueScreen").then((m) => ({ default: m.ReviewQueueScreen }))
);

type AppRoute =
  | "/"
  | "/privacy"
  | "/open-source"
  | "/guide/keys"
  | "/guide/local-models"
  | "/roadmap"
  | "/help"
  | "/404"
  | "/app/home"
  | "/app/skills"
  | "/app/practice"
  | "/app/history"
  | "/app/settings"
  | "/app/models"
  | "/app/companies"
  | "/app/schedule"
  | "/app/review"
  | "/app/setup/ai"
  | "/app/setup/profile"
  | "/app/setup/session"
  | "/app/interview"
  | "/app/results";

function isPublicRoute(r: AppRoute): boolean {
  return (
    r === "/" ||
    r === "/privacy" ||
    r === "/open-source" ||
    r === "/guide/keys" ||
    r === "/guide/local-models" ||
    r === "/roadmap" ||
    r === "/help" ||
    r === "/404"
  );
}

function getInitialRoute(): AppRoute {
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    if (path === "/privacy") return "/privacy";
    if (path === "/open-source") return "/open-source";
    if (path === "/guide/keys") return "/guide/keys";
    if (path === "/guide/local-models") return "/guide/local-models";
    if (path === "/roadmap") return "/roadmap";
    if (path === "/help") return "/help";
    if (path === "/404") return "/404";
    if (path === "/") return "/";

    if (path.includes("interview") || window.location.hash.includes("interview")) {
      return "/app/interview";
    }
    if (path.includes("results") || window.location.hash.includes("results")) {
      return "/app/results";
    }
    if (path.includes("skills") || window.location.hash.includes("skills")) {
      return "/app/skills";
    }
    if (path.includes("practice") || window.location.hash.includes("practice")) {
      return "/app/practice";
    }
    if (path.includes("history") || window.location.hash.includes("history")) {
      return "/app/history";
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
    if (path.includes("companies") || window.location.hash.includes("companies")) {
      return "/app/companies";
    }
    if (path.includes("schedule") || window.location.hash.includes("schedule")) {
      return "/app/schedule";
    }
    if (path.includes("review") || window.location.hash.includes("review")) {
      return "/app/review";
    }
    if (path.includes("settings") || window.location.hash.includes("settings")) {
      return "/app/settings";
    }
    if (path.includes("models") || window.location.hash.includes("models")) {
      return "/app/models";
    }
    if (
      path === "/app" ||
      path === "/app/" ||
      path.includes("home") ||
      window.location.hash.includes("home")
    ) {
      return "/app/home";
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
  const [resultsSessionId, setResultsSessionId] = useState<string | null>(null);
  const [practiceSkillId, setPracticeSkillId] = useState<string | null>(null);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);
  const [selectedCompanySlugForSession, setSelectedCompanySlugForSession] = useState<string | null>(
    null
  );
  const [init, setInit] = useState<InitState>({ status: "loading" });
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeSession, setActiveSession] = useState<{
    plan: SessionPlan;
    questions: SelectedQuestion[];
    companyPack?: CompanyPack | null;
  } | null>(null);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [reloadUpdate, setReloadUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    registerPwa({
      onUpdateAvailable: (reload) => {
        setReloadUpdate(() => reload);
        setUpdateAvailable(true);
      },
    });
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
    if (isPublicRoute(route)) {
      return;
    }
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
  }, [reloadKey, route]);

  const storage = init.status === "ready" ? init.storage : null;
  const { preference, setThemePreference } = useTheme(storage);

  useEffect(() => {
    if (isPublicRoute(route) || init.status !== "loading") {
      (window as unknown as { AbhyasPreloader?: { hide: () => void } }).AbhyasPreloader?.hide();
    }
  }, [init.status, route]);

  const handleWriteError = useCallback((error: unknown) => {
    if (isQuotaExceededError(error)) setQuotaExceeded(true);
  }, []);

  const handleStartSession = useCallback(
    async (plan: SessionPlan) => {
      if (!storage) return;
      try {
        const structured = await storage.getAll<StructuredProfile>("structuredProfiles");
        const profile = structured[0] ?? null;
        let companyPack: CompanyPack | null = null;
        if (plan.companySlug) {
          const cached = await loadCompanyPack(plan.companySlug, storage);
          companyPack = cached?.pack ?? null;
        }
        const result = await selectQuestions({
          plan,
          bank: DEFAULT_QUESTION_BANK,
          profile,
          companyPack,
        });
        setActiveSession({ plan, questions: result.questions, companyPack });
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

  if (isPublicRoute(route)) {
    switch (route) {
      case "/":
        return <LandingPage />;
      case "/privacy":
        return <PrivacyPage />;
      case "/open-source":
        return <OpenSourcePage />;
      case "/guide/keys":
        return <KeyGuidePage />;
      case "/guide/local-models":
        return <LocalModelsGuidePage />;
      case "/roadmap":
        return <RoadmapPage />;
      case "/help":
        return <TroubleshootingPage />;
      case "/404":
      default:
        return <NotFoundPage mode="not-found" />;
    }
  }

  if (init.status === "loading") {
    return (
      <div className="abh-app abh-app--standalone">
        <div className="abh-app-loading" aria-busy="true" aria-label="Loading Abhyas">
          <AbhyasLoader label="Loading Abhyas..." />
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

  const renderPwaUpdateBanner = () =>
    updateAvailable && reloadUpdate ? (
      <div className="abh-pwa-update-banner" role="status" aria-live="polite">
        <div className="abh-pwa-update-content">
          <span>A new version of Abhyas is available.</span>
          <Button
            variant="secondary"
            onClick={() => {
              reloadUpdate();
            }}
          >
            Reload &amp; Update
          </Button>
        </div>
      </div>
    ) : null;

  const renderOfflineBanner = () =>
    isOffline ? (
      <Banner
        variant="warning"
        message="You are currently offline. Local data, review, and settings are available; cloud AI connections require network access."
      />
    ) : null;

  const renderTopBanners = () => (
    <>
      {renderPwaUpdateBanner()}
      {renderOfflineBanner()}
    </>
  );

  function DelayedViewFallback() {
    const [show, setShow] = useState(false);
    useEffect(() => {
      const timer = setTimeout(() => setShow(true), 250);
      return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
      <div className="abh-app-loading" role="status" aria-label="Loading view">
        <Skeleton height="32px" width="35%" style={{ marginBottom: "var(--space-4)" }} />
        <Skeleton height="120px" width="100%" style={{ marginBottom: "var(--space-4)" }} />
        <Skeleton height="180px" width="100%" />
      </div>
    );
  }

  const screenLoading = <DelayedViewFallback />;

  const renderAppNav = (currentRoute: AppRoute) => (
    <aside className="abh-app-nav">
      <a
        className="abh-brand-lockup"
        href="/app/home"
        aria-label="Abhyas Home"
        onClick={(e) => {
          e.preventDefault();
          navigateTo("/app/home");
        }}
      >
        <BrandMark size={24} />
        <span className="abh-wordmark" aria-hidden="true">
          Abhyas
        </span>
      </a>
      <nav aria-label="App">
        <ul className="abh-app-nav-list">
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/home"
              aria-current={currentRoute === "/app/home" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/home");
              }}
            >
              Home
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/skills"
              aria-current={currentRoute === "/app/skills" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/skills");
              }}
            >
              Skills
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/practice"
              aria-current={currentRoute === "/app/practice" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/practice");
              }}
            >
              Practice
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/history"
              aria-current={currentRoute === "/app/history" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setHistorySessionId(null);
                navigateTo("/app/history");
              }}
            >
              History
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/companies"
              aria-current={currentRoute === "/app/companies" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/companies");
              }}
            >
              Companies
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/schedule"
              aria-current={currentRoute === "/app/schedule" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/schedule");
              }}
            >
              Schedule
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/review"
              aria-current={currentRoute === "/app/review" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/review");
              }}
            >
              Review
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/setup/ai"
              aria-current={currentRoute === "/app/setup/ai" ? "page" : undefined}
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
              aria-current={currentRoute === "/app/setup/profile" ? "page" : undefined}
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
              aria-current={currentRoute === "/app/setup/session" ? "page" : undefined}
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
              href="/app/models"
              aria-current={currentRoute === "/app/models" ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigateTo("/app/models");
              }}
            >
              Models
            </a>
          </li>
          <li>
            <a
              className="abh-app-nav-item"
              href="/app/settings"
              aria-current={currentRoute === "/app/settings" ? "page" : undefined}
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
  );

  if (route === "/app/setup/ai") {
    return (
      <div className="abh-app abh-app--standalone">
        {renderTopBanners()}
        <Suspense fallback={screenLoading}>
          <AISetupScreen
            storage={init.storage}
            onComplete={() => navigateTo("/app/setup/profile")}
            onNavigateSettings={() => navigateTo("/app/settings")}
            onNavigateModelManager={() => navigateTo("/app/models")}
            onNavigateHome={() => navigateTo("/app/home")}
          />
        </Suspense>
      </div>
    );
  }

  if (route === "/app/setup/profile") {
    return (
      <div className="abh-app abh-app--standalone">
        {renderTopBanners()}
        <Suspense fallback={screenLoading}>
          <ProfileScreen
            storage={init.storage}
            onComplete={() => navigateTo("/app/setup/session")}
            onBack={() => navigateTo("/app/setup/ai")}
            onNavigateSettings={() => navigateTo("/app/settings")}
            onNavigateHome={() => navigateTo("/app/home")}
          />
        </Suspense>
      </div>
    );
  }

  if (route === "/app/setup/session") {
    return (
      <div className="abh-app abh-app--standalone">
        {renderTopBanners()}
        <Suspense fallback={screenLoading}>
          <SessionSetupScreen
            storage={init.storage}
            initialCompanySlug={selectedCompanySlugForSession}
            onStart={(plan) => void handleStartSession(plan)}
            onBack={() => navigateTo("/app/setup/profile")}
            onNavigateAISetup={() => navigateTo("/app/setup/ai")}
            onNavigateSettings={() => navigateTo("/app/settings")}
            onNavigateHome={() => navigateTo("/app/home")}
          />
        </Suspense>
      </div>
    );
  }

  if (route === "/app/interview") {
    if (!activeSession) {
      return (
        <div className="abh-app abh-app--standalone">
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
      <div className="abh-app abh-app--standalone">
        {renderTopBanners()}
        <Suspense fallback={screenLoading}>
          <LiveInterviewScreen
            storage={init.storage}
            plan={activeSession.plan}
            questions={activeSession.questions}
            companyPack={activeSession.companyPack}
            provider={activeSession.plan.isLocalModel ? getLocalEngineAdapter() : undefined}
            onFinish={(completedSessionId) => {
              setActiveSession(null);
              if (completedSessionId) {
                setResultsSessionId(completedSessionId);
                navigateTo("/app/results");
              } else {
                navigateTo("/app/home");
              }
            }}
            onExit={() => {
              setActiveSession(null);
              navigateTo("/app/setup/session");
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (route === "/app/results") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <ResultsScreen
              storage={init.storage}
              sessionId={resultsSessionId ?? ""}
              onRetryQuestion={() => navigateTo("/app/setup/session")}
              onPracticeSkill={() => navigateTo("/app/practice")}
              onNavigateSkills={() => navigateTo("/app/skills")}
              onFinish={() => {
                setResultsSessionId(null);
                navigateTo("/app/home");
              }}
              onNavigateHome={() => {
                setResultsSessionId(null);
                navigateTo("/app/home");
              }}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/skills") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <SkillsDashboardScreen
              storage={init.storage}
              onPracticeSkill={(skillId) => {
                setPracticeSkillId(skillId);
                navigateTo("/app/practice");
              }}
              onStartSession={() => navigateTo("/app/setup/session")}
              onNavigateHome={() => navigateTo("/app/home")}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/practice") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <SkillPracticeScreen
              storage={init.storage}
              initialSkillId={practiceSkillId}
              onStartDrill={(plan, questions) => {
                setActiveSession({ plan, questions });
                navigateTo("/app/interview");
              }}
              onStartSession={() => navigateTo("/app/setup/session")}
              onNavigateSkills={() => navigateTo("/app/skills")}
              onNavigateHome={() => navigateTo("/app/home")}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/history") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <HistoryScreen
              storage={init.storage}
              initialSessionId={historySessionId}
              onSelectSession={(sid) => setHistorySessionId(sid)}
              onStartSession={() => navigateTo("/app/setup/session")}
              onPracticeSkill={(skillId) => {
                setPracticeSkillId(skillId);
                navigateTo("/app/practice");
              }}
              onRetryQuestion={(_qid) => {
                navigateTo("/app/setup/session");
              }}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/home") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <HomeScreen
            storage={init.storage}
            onStartSession={() => navigateTo("/app/setup/session")}
            onViewResults={(sid) => {
              setResultsSessionId(sid);
              navigateTo("/app/results");
            }}
            onStartDailyDrill={(skillId) => {
              setPracticeSkillId(skillId);
              navigateTo("/app/practice");
            }}
            onNavigateHistory={() => navigateTo("/app/history")}
            onNavigateSettings={() => navigateTo("/app/settings")}
            onNavigateProfile={() => navigateTo("/app/setup/profile")}
            onNavigateSkills={() => navigateTo("/app/skills")}
            onNavigateSchedule={() => navigateTo("/app/schedule")}
          />
        </main>
      </div>
    );
  }

  if (route === "/app/companies") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <CompanyDirectoryScreen
              storage={init.storage}
              initialCompanySlug={selectedCompanySlugForSession}
              onSelectCompanyForSession={(slug) => {
                setSelectedCompanySlugForSession(slug);
              }}
              onNavigateSessionSetup={() => {
                navigateTo("/app/setup/session");
              }}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/schedule") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <ScheduleScreen
              storage={init.storage}
              onNavigatePractice={() => navigateTo("/app/practice")}
              onNavigateHome={() => navigateTo("/app/home")}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/review") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <ReviewQueueScreen
              storage={init.storage}
              onStartReviewDrill={(plan, questions) => {
                setActiveSession({ plan, questions });
                navigateTo("/app/interview");
              }}
              onNavigatePractice={() => navigateTo("/app/practice")}
              onNavigateHome={() => navigateTo("/app/home")}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  if (route === "/app/models") {
    return (
      <div className="abh-app">
        {renderTopBanners()}
        {renderAppNav(route)}
        <main className="abh-app-main">
          <Suspense fallback={screenLoading}>
            <ModelManagerScreen
              storage={init.storage}
              onNavigateBack={() => navigateTo("/app/settings")}
              onNavigateAISetup={() => navigateTo("/app/setup/ai")}
            />
          </Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="abh-app">
      {renderTopBanners()}
      {renderAppNav(route)}
      <main className="abh-app-main">
        <Suspense fallback={screenLoading}>
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
        </Suspense>
      </main>
    </div>
  );
}
