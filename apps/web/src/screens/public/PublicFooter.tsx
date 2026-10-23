// FR-033, ADR-019, design.md section 8: Public footer with sitemap links, trademark note and privacy guarantees.
import { BrandMark } from "../../components/BrandMark";

export function PublicFooter() {
  return (
    <footer className="abh-public-footer" role="contentinfo">
      <div className="abh-public-container">
        <div className="abh-footer-grid">
          {/* Brand Col */}
          <div className="abh-footer-col">
            <a href="/" className="abh-brand-lockup" aria-label="Abhyas Home">
              <BrandMark size={32} />
              <span className="abh-brand-name">ABHYAS</span>
            </a>

            <p
              className="abh-prose"
              style={{ fontSize: "14px", marginTop: "12px", color: "var(--text-muted)" }}
            >
              Private, realistic AI voice interview practice that runs entirely on your device. Zero
              telemetry, no accounts, and honest feedback.
            </p>

            <div
              style={{
                marginTop: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "13px",
                fontFamily: "var(--font-mono)",
              }}
            >
              <div>
                Developer:{" "}
                <a
                  href="https://github.com/Samyak9109"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--accent-text)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Samyak Jain
                </a>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a
                  href="https://github.com/Samyak9109"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text-muted)", textDecoration: "none" }}
                >
                  GitHub: @Samyak9109 ↗
                </a>
                <a
                  href="https://buymeacoffee.com/samyak9109"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--accent-text)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  ☕ Buy me a coffee ↗
                </a>
              </div>
            </div>
          </div>

          {/* Product */}
          <div className="abh-footer-col">
            <span className="abh-footer-col-title">&#123; Product &#125;</span>
            <a href="/app/setup/ai" className="abh-footer-link">
              Start practice
            </a>
            <a href="/#why-choose-us" className="abh-footer-link">
              Why choose us
            </a>
            <a href="/#experience" className="abh-footer-link">
              The experience
            </a>
            <a href="/#faq" className="abh-footer-link">
              Frequently asked questions
            </a>
          </div>

          {/* Trust & Transparency */}
          <div className="abh-footer-col">
            <span className="abh-footer-col-title">&#123; Trust &amp; Code &#125;</span>
            <a href="/privacy" className="abh-footer-link">
              Privacy architecture
            </a>
            <a href="/open-source" className="abh-footer-link">
              Open source &amp; license
            </a>
            <a
              href="https://github.com/Samyak9109/Abhyas"
              target="_blank"
              rel="noopener noreferrer"
              className="abh-footer-link"
            >
              GitHub repository ↗
            </a>
            <a
              href="https://github.com/Samyak9109"
              target="_blank"
              rel="noopener noreferrer"
              className="abh-footer-link"
            >
              Developer GitHub (@Samyak9109) ↗
            </a>
            <a
              href="https://buymeacoffee.com/samyak9109"
              target="_blank"
              rel="noopener noreferrer"
              className="abh-footer-link"
            >
              Buy me a coffee ☕
            </a>
          </div>


          {/* Guides & Support */}
          <div className="abh-footer-col">
            <span className="abh-footer-col-title">&#123; Guides &#125;</span>
            <a href="/guide/keys" className="abh-footer-link">
              API key setup guide
            </a>
            <a href="/guide/local-models" className="abh-footer-link">
              Local models guide
            </a>
            <a href="/help" className="abh-footer-link">
              Troubleshooting &amp; support
            </a>
            <a href="/404" className="abh-footer-link">
              Error &amp; offline fallback
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="abh-footer-bottom">
          <div>
            <p style={{ margin: "0 0 6px 0" }}>
              MIT Licensed. Copyright © 2026 Samyak Jain. Trademark policy: &quot;Abhyas&quot; and the pixel monitor-head
              mascot are trademarks. Forks must rename.
            </p>

            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
              Abhyas is an independent open-source project. Not affiliated with Google, OpenAI, or
              any third-party AI provider.
            </p>
          </div>

          <div className="abh-footer-badges">
            <span className="abh-footer-pill">Zero Telemetry</span>
            <span className="abh-footer-pill">100% Private</span>
            <span className="abh-footer-pill">Client-Side Only</span>
            <span className="abh-footer-pill">MIT License</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
