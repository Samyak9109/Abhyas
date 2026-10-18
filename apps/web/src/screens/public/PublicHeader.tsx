// FR-033, ADR-019, design.md section 8: Public header with brand lockup, navigation, theme toggle and CTA.
import { useState, useEffect } from "react";
import { mirrorThemePreference } from "../../services/theme";

interface PublicHeaderProps {
  currentPath?: string;
  onThemeToggle?: () => void;
  currentTheme?: "ink" | "paper";
}

export function PublicHeader({
  currentPath = "/",
  onThemeToggle,
  currentTheme = "ink",
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [targetAppUrl, setTargetAppUrl] = useState("/app/setup/ai");

  useEffect(() => {
    // Check if the user has a prior session or profile in local storage
    if (typeof window !== "undefined") {
      try {
        const hasExistingProfile =
          localStorage.getItem("abhyas_active_profile") ||
          localStorage.getItem("abhyas_has_completed_setup") ||
          localStorage.getItem("abhyas_provider");
        if (hasExistingProfile) {
          setTargetAppUrl("/app/home");
        }
      } catch {
        // Storage access might fail in private sandboxes; fallback remains /app/setup/ai
      }
    }
  }, []);

  const handleThemeClick = () => {
    if (onThemeToggle) {
      onThemeToggle();
      return;
    }
    if (typeof document !== "undefined") {
      const nextTheme =
        document.documentElement.getAttribute("data-theme") === "paper" ? "ink" : "paper";
      document.documentElement.setAttribute("data-theme", nextTheme);
      mirrorThemePreference(nextTheme);
    }
  };

  return (
    <header className="abh-public-header" role="banner">
      <a href="/" className="abh-brand-lockup" aria-label="Abhyas Home">
        <span className="abh-brand-mark" aria-hidden="true">
          ■
        </span>
        <span className="abh-brand-name">ABHYAS</span>
      </a>

      {/* Desktop Navigation */}
      <nav className="abh-public-nav" aria-label="Public site navigation">
        <a
          href="/#why-choose-us"
          className="abh-nav-link"
          aria-current={currentPath === "/#why-choose-us" ? "page" : undefined}
        >
          &#123; Why choose us &#125;
        </a>
        <a
          href="/#experience"
          className="abh-nav-link"
          aria-current={currentPath === "/#experience" ? "page" : undefined}
        >
          &#123; Experience &#125;
        </a>
        <a
          href="/privacy"
          className="abh-nav-link"
          aria-current={currentPath === "/privacy" ? "page" : undefined}
        >
          &#123; Privacy &#125;
        </a>
        <a
          href="/guide/keys"
          className="abh-nav-link"
          aria-current={currentPath === "/guide/keys" ? "page" : undefined}
        >
          &#123; Key Guide &#125;
        </a>
        <a
          href="/guide/local-models"
          className="abh-nav-link"
          aria-current={currentPath === "/guide/local-models" ? "page" : undefined}
        >
          &#123; Local Models &#125;
        </a>
        <a
          href="/help"
          className="abh-nav-link"
          aria-current={currentPath === "/help" ? "page" : undefined}
        >
          &#123; Help &#125;
        </a>
        <a
          href="/open-source"
          className="abh-nav-link"
          aria-current={currentPath === "/open-source" ? "page" : undefined}
        >
          &#123; Open Source &#125;
        </a>
      </nav>

      {/* Actions */}
      <div className="abh-header-actions">
        <button
          type="button"
          onClick={handleThemeClick}
          className="abh-theme-toggle"
          aria-label={`Switch to ${currentTheme === "ink" ? "Paper (light)" : "Ink (dark)"} theme`}
        >
          {currentTheme === "ink" ? "PAPER ☼" : "INK ☾"}
        </button>

        <a
          href={targetAppUrl}
          className="abh-hero-cta-btn"
          style={{ padding: "8px 16px", fontSize: "12px" }}
        >
          Start practice
        </a>

        <button
          type="button"
          className="abh-mobile-menu-btn"
          aria-expanded={mobileMenuOpen}
          aria-controls="abh-mobile-menu"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          id="abh-mobile-menu"
          className="abh-mobile-drawer"
          role="region"
          aria-label="Mobile Navigation"
        >
          <a
            href="/#why-choose-us"
            className="abh-nav-link"
            onClick={() => setMobileMenuOpen(false)}
          >
            &#123; Why choose us &#125;
          </a>
          <a href="/#experience" className="abh-nav-link" onClick={() => setMobileMenuOpen(false)}>
            &#123; Experience &#125;
          </a>
          <a href="/privacy" className="abh-nav-link" onClick={() => setMobileMenuOpen(false)}>
            &#123; Privacy &#125;
          </a>
          <a href="/guide/keys" className="abh-nav-link" onClick={() => setMobileMenuOpen(false)}>
            &#123; Key Guide &#125;
          </a>
          <a href="/guide/local-models" className="abh-nav-link" onClick={() => setMobileMenuOpen(false)}>
            &#123; Local Models &#125;
          </a>
          <a href="/help" className="abh-nav-link" onClick={() => setMobileMenuOpen(false)}>
            &#123; Help &#125;
          </a>
          <a href="/open-source" className="abh-nav-link" onClick={() => setMobileMenuOpen(false)}>
            &#123; Open Source &#125;
          </a>
        </div>
      )}
    </header>
  );
}
