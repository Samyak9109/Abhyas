// FR-033, FR-031, ADR-019, design.md section 8: PG-08 Not-found, unsupported-browser, and offline shells.
import { Mascot } from "../../components/Mascot";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

interface NotFoundPageProps {
  mode?: "not-found" | "unsupported-browser" | "offline";
}

export function NotFoundPage({ mode = "not-found" }: NotFoundPageProps) {
  const getHeader = () => {
    switch (mode) {
      case "unsupported-browser":
        return {
          title: "BROWSER COMPATIBILITY NOTICE",
          subtitle:
            "Your current browser does not support required speech recognition or WebAssembly APIs.",
          mascotFace: "problem" as const,
          primaryActionText: "Go to troubleshooting guide",
          primaryActionHref: "/help",
          secondaryActionText: "Continue in text mode",
          secondaryActionHref: "/app/setup/ai",
        };
      case "offline":
        return {
          title: "YOU ARE OFFLINE",
          subtitle:
            "No active network connection detected. Your locally saved sessions and question drills remain fully accessible.",
          mascotFace: "ready" as const,
          primaryActionText: "Retry connection",
          primaryActionHref: "/",
          secondaryActionText: "Open practice app",
          secondaryActionHref: "/app/home",
        };
      case "not-found":
      default:
        return {
          title: "PAGE NOT FOUND (404)",
          subtitle: "The route you requested does not exist or may have been moved.",
          mascotFace: "problem" as const,
          primaryActionText: "Return to home",
          primaryActionHref: "/",
          secondaryActionText: "Start practice app",
          secondaryActionHref: "/app/setup/ai",
        };
    }
  };

  const config = getHeader();

  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/404" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <div className="abh-fallback-shell">
            <Mascot size="card" face={config.mascotFace} alt="Pixel mascot indicator" />

            <span className="abh-bracket-label">&#123; Status Code &#125;</span>
            <h1 className="abh-section-heading" style={{ margin: "0" }}>
              {config.title}
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>

            <p className="abh-hero-promise" style={{ textAlign: "center", maxWidth: "600px" }}>
              {config.subtitle}
            </p>

            <div
              style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}
            >
              <a href={config.primaryActionHref} className="abh-hero-cta-btn">
                {config.primaryActionText}
              </a>
              {config.secondaryActionText && (
                <a
                  href={config.secondaryActionHref}
                  className="abh-boxed-link"
                  style={{ display: "inline-flex", alignItems: "center" }}
                >
                  {config.secondaryActionText}
                </a>
              )}
            </div>

            <div style={{ marginTop: "24px" }}>
              <a
                href="/help"
                style={{
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-muted)",
                }}
              >
                Need help? View Troubleshooting &amp; System Compatibility →
              </a>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
