// FR-033, ADR-019, design.md section 8: PG-05 Troubleshooting and Compatibility Page.
import { useState } from "react";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function TroubleshootingPage() {
  const [filterQuery, setFilterQuery] = useState("");

  const errorItems = [
    {
      id: "err-key",
      title: "Invalid API Key or Authentication Failure",
      category: "Authentication",
      cause:
        "Mistyped key string, unintended leading/trailing whitespace, or revoked key credentials in Google AI Studio / OpenAI Platform.",
      fix: "Navigate to AI Setup in Abhyas. Re-copy your key directly from your provider dashboard. Verify there are no whitespace characters at the start or end, and click 'Test connection'.",
    },
    {
      id: "err-quota",
      title: "Quota Exceeded or Rate Limit Reached",
      category: "Provider Limits",
      cause:
        "You have exceeded your provider's per-minute request rate (e.g. Gemini 15 RPM free tier) or exhausted prepaid billing credits (OpenAI).",
      fix: "Wait 60 seconds and submit your turn again. If using OpenAI, check your account credit balance in platform.openai.com. Abhyas shows estimated token cost before each turn.",
    },
    {
      id: "err-mic",
      title: "Microphone Permission Denied or Not Detected",
      category: "Speech / Audio",
      cause: "Your browser or operating system blocked microphone access for Abhyas.",
      fix: "Click the lock/settings icon in your browser URL bar, ensure Microphone is set to 'Allow', and refresh the page. You can also switch to typing: voice and text are equal first-class citizens in Abhyas.",
    },
    {
      id: "err-storage",
      title: "Storage Quota Exceeded or IndexedDB Error",
      category: "Storage",
      cause:
        "Device disk space is nearly full, or browser incognito/private mode limits IndexedDB storage.",
      fix: "Open Settings in Abhyas, export a backup of your data, and click 'Delete all data' to purge old sessions. In incognito mode, Abhyas runs in memory mode which discards state upon closing.",
    },
    {
      id: "err-offline",
      title: "Network Error or Connection Lost",
      category: "Network",
      cause: "Internet dropped during turn generation with a cloud AI provider.",
      fix: "Abhyas automatically saves your partial session progress without data loss. Reconnect to the internet and click 'Retry', or run local models with Ollama for 100% offline practice.",
    },
  ];

  const filteredErrors = errorItems.filter(
    (item) =>
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.cause.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/help" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">&#123; Troubleshooting &amp; Support &#125;</span>
            <h1 className="abh-content-title">
              COMPATIBILITY &amp; ERROR FIXES
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <p className="abh-content-subtitle">
              Browser support specifications, common error diagnostics, and recovery instructions.
            </p>
          </header>

          {/* Section 1: Browser Support Matrix */}
          <section className="abh-content-section" aria-labelledby="matrix-heading">
            <h2 id="matrix-heading" className="abh-content-h2">
              1. Browser Support Matrix
            </h2>
            <div className="abh-table-wrap">
              <table className="abh-data-table" aria-label="Browser Compatibility Matrix">
                <thead>
                  <tr>
                    <th scope="col">Browser</th>
                    <th scope="col">Push-to-Talk Voice</th>
                    <th scope="col">Speech Output</th>
                    <th scope="col">Storage (IndexedDB)</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Google Chrome</strong> (Desktop &amp; Android)
                    </td>
                    <td>Supported (Web Speech API)</td>
                    <td>Supported (Web Speech Synthesis)</td>
                    <td>Persistent</td>
                    <td>
                      <span style={{ color: "var(--success)" }}>Recommended</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Microsoft Edge</strong> (Desktop)
                    </td>
                    <td>Supported (Web Speech API)</td>
                    <td>Supported (Web Speech Synthesis)</td>
                    <td>Persistent</td>
                    <td>
                      <span style={{ color: "var(--success)" }}>Full Support</span>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Mozilla Firefox</strong>
                    </td>
                    <td>Requires speech flag / Text fallback</td>
                    <td>Supported</td>
                    <td>Persistent</td>
                    <td>Supported (Text mode recommended)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Apple Safari</strong> (macOS &amp; iOS)
                    </td>
                    <td>Supported with permissions</td>
                    <td>Supported</td>
                    <td>Persistent</td>
                    <td>Supported</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 2: Error Directory */}
          <section className="abh-content-section" aria-labelledby="errors-heading">
            <h2 id="errors-heading" className="abh-content-h2">
              2. Error Directory &amp; Remedies
            </h2>
            <div style={{ marginBottom: "24px" }}>
              <input
                type="search"
                className="abh-input"
                placeholder="Search error causes (e.g. quota, microphone, key)..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "500px",
                  padding: "10px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--line-strong)",
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                }}
                aria-label="Filter troubleshooting items"
              />
            </div>

            <div className="abh-faq-list">
              {filteredErrors.map((item) => (
                <details key={item.id} className="abh-faq-item">
                  <summary className="abh-faq-summary">
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-text)",
                          marginRight: "10px",
                        }}
                      >
                        [{item.category.toUpperCase()}]
                      </span>
                      <span>{item.title}</span>
                    </div>
                    <span className="abh-faq-icon" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="abh-faq-body">
                    <p style={{ margin: "0 0 8px 0" }}>
                      <strong>Cause:</strong> {item.cause}
                    </p>
                    <p style={{ margin: 0 }}>
                      <strong>Remedy:</strong> {item.fix}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Section 3: Copyable Diagnostics Instructions */}
          <section className="abh-content-section" aria-labelledby="diag-heading">
            <h2 id="diag-heading" className="abh-content-h2">
              3. How to Generate a Redacted Diagnostic Report
            </h2>
            <div className="abh-prose">
              <p>
                If you encounter a persistent bug, you can generate a safe, redacted diagnostic
                report directly from the app to attach to your GitHub issue:
              </p>
              <ol>
                <li>
                  Open{" "}
                  <a href="/app/settings" style={{ color: "var(--accent-text)" }}>
                    Settings
                  </a>{" "}
                  inside Abhyas.
                </li>
                <li>
                  Scroll to the <strong>Diagnostics</strong> card.
                </li>
                <li>
                  Click <strong>&quot;Copy diagnostics to clipboard&quot;</strong>.
                </li>
                <li>
                  Paste the text into your issue. All keys, resumes, and personal details are
                  automatically redacted with <code>[REDACTED]</code>.
                </li>
              </ol>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
