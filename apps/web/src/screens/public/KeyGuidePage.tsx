// FR-033, FR-005, ADR-019, design.md section 8: PG-04 Key Guide Page with verified last-checked date.
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function KeyGuidePage() {
  const LAST_CHECKED_DATE = "October 2026";

  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/guide/keys" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">&#123; Provider Key Guide &#125;</span>
            <h1 className="abh-content-title">
              API KEY SETUP GUIDE
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <div
              className="abh-date-badge"
              role="status"
              aria-label={`Guide status: Last checked ${LAST_CHECKED_DATE}`}
            >
              <span>●</span> Last checked: {LAST_CHECKED_DATE}
            </div>
            <p className="abh-content-subtitle">
              Abhyas uses a Bring Your Own Key (BYOK) model. Your key is stored exclusively in your
              browser and used only to connect directly to the provider you choose.
            </p>
          </header>

          {/* Key Safety Notice */}
          <div
            className="abh-code-box"
            style={{ position: "static", margin: "32px 0", maxWidth: "800px" }}
          >
            &gt; KEY SAFETY GUARANTEE:
            <br />
            &gt; Keys are never sent to any Abhyas server or logged to telemetry.
            <br />
            &gt; Keys are stored in browser IndexedDB with optional AES-GCM encryption.
            <br />
            &gt; Sent only to the official provider origin (Google or OpenAI) via HTTPS.
          </div>

          {/* Provider 1: Google Gemini */}
          <section className="abh-content-section" aria-labelledby="gemini-guide-heading">
            <h2 id="gemini-guide-heading" className="abh-content-h2">
              1. Google Gemini API Key
            </h2>
            <p className="abh-prose">
              Google provides Gemini API keys through Google AI Studio. Gemini offers a generous
              free tier suitable for frequent practice.
            </p>

            <div className="abh-stepper-card">
              <div className="abh-step-head">
                <span className="abh-step-badge">1</span>
                <h3 className="abh-step-head-title">Open Google AI Studio</h3>
              </div>
              <p className="abh-prose">
                Visit{" "}
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-text)" }}
                >
                  aistudio.google.com ↗
                </a>{" "}
                and sign in with your Google account.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">2</span>
                <h3 className="abh-step-head-title">Create your API key</h3>
              </div>
              <p className="abh-prose">
                Click <strong>&quot;Get API key&quot;</strong> in the navigation sidebar, then
                choose <strong>&quot;Create API key in new project&quot;</strong>.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">3</span>
                <h3 className="abh-step-head-title">Copy your secret string</h3>
              </div>
              <p className="abh-prose">
                Copy the generated key (starts with <code>AIza...</code>). Store it safely or paste
                it directly into Abhyas.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">4</span>
                <h3 className="abh-step-head-title">Paste &amp; test in Abhyas</h3>
              </div>
              <p className="abh-prose">
                Open{" "}
                <a href="/app/setup/ai" style={{ color: "var(--accent-text)" }}>
                  AI Setup
                </a>{" "}
                in Abhyas, select <strong>Gemini</strong>, paste your key, and click{" "}
                <strong>&quot;Test connection&quot;</strong>.
              </p>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              * Free tier terms and request quotas are subject to Google&apos;s developer terms.
              Always check Google AI Studio for current limits.
            </p>
          </section>

          {/* Provider 2: OpenAI */}
          <section className="abh-content-section" aria-labelledby="openai-guide-heading">
            <h2 id="openai-guide-heading" className="abh-content-h2">
              2. OpenAI API Key
            </h2>
            <p className="abh-prose">
              OpenAI provides API keys through the OpenAI Platform. An account with active prepaid
              balance or promotional credits is required.
            </p>

            <div className="abh-stepper-card">
              <div className="abh-step-head">
                <span className="abh-step-badge">1</span>
                <h3 className="abh-step-head-title">Open OpenAI Platform</h3>
              </div>
              <p className="abh-prose">
                Visit{" "}
                <a
                  href="https://platform.openai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-text)" }}
                >
                  platform.openai.com ↗
                </a>{" "}
                and log in to your developer account.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">2</span>
                <h3 className="abh-step-head-title">Generate a secret key</h3>
              </div>
              <p className="abh-prose">
                Navigate to <strong>API Keys</strong> in your dashboard settings and click{" "}
                <strong>&quot;Create new secret key&quot;</strong>. Label it &quot;Abhyas
                Practice&quot;.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">3</span>
                <h3 className="abh-step-head-title">Copy your key</h3>
              </div>
              <p className="abh-prose">
                Copy the generated key (starts with <code>sk-...</code>). Note: OpenAI displays this
                key string only once upon generation.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">4</span>
                <h3 className="abh-step-head-title">Paste &amp; test in Abhyas</h3>
              </div>
              <p className="abh-prose">
                Open{" "}
                <a href="/app/setup/ai" style={{ color: "var(--accent-text)" }}>
                  AI Setup
                </a>{" "}
                in Abhyas, select <strong>OpenAI</strong>, paste your key, and click{" "}
                <strong>&quot;Test connection&quot;</strong>.
              </p>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              * OpenAI charges on a pay-as-you-go token basis. Practice sessions typically consume
              between 1,000 and 4,000 tokens ($0.001 - $0.01 per session).
            </p>
          </section>

          {/* Section 3: Next Step CTA */}
          <div style={{ marginTop: "48px" }}>
            <a href="/app/setup/ai" className="abh-hero-cta-btn">
              Configure your API key now →
            </a>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
