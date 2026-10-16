// FR-033, ADR-005, ADR-019, design.md section 8: PG-02 Privacy Page.
// Verifiably matches docs/privacy-audit.md.
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function PrivacyPage() {
  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/privacy" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">
              &#123; Privacy Architecture &amp; Data Audit &#125;
            </span>
            <h1 className="abh-content-title">
              WHAT LEAVES YOUR DEVICE
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <p className="abh-content-subtitle">
              Abhyas is architected as a local-first, zero-telemetry application. We have no user
              accounts, no tracking scripts, and no intermediary AI proxy servers.
            </p>
          </header>

          {/* Section 1: Core Tenets */}
          <section className="abh-content-section" aria-labelledby="tenets-heading">
            <h2 id="tenets-heading" className="abh-content-h2">
              1. Core Tenets
            </h2>
            <div className="abh-prose">
              <ul>
                <li>
                  <strong>Zero Telemetry:</strong> No analytics SDKs, tracking pixels, crash
                  telemetry, or session recording.
                </li>
                <li>
                  <strong>No User Accounts:</strong> No sign up, no passwords, and no cloud profile
                  database. State lives solely in your browser&apos;s IndexedDB.
                </li>
                <li>
                  <strong>Direct AI Egress (BYOK):</strong> Your API key sends requests directly
                  from your browser to your chosen AI provider origin. Prompts never pass through an
                  Abhyas backend.
                </li>
                <li>
                  <strong>Self-Hosted Assets:</strong> All typefaces (Pixelify Sans, Instrument
                  Sans, JetBrains Mono, Caveat), stylesheets, and scripts are bundled and served
                  strictly from our own origin. No third-party font CDNs.
                </li>
                <li>
                  <strong>Local Fallback:</strong> When using local models (via Ollama or WebGPU),
                  zero network calls leave your computer during practice sessions.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2: Data Classification & Storage Inventory */}
          <section className="abh-content-section" aria-labelledby="data-inv-heading">
            <h2 id="data-inv-heading" className="abh-content-h2">
              2. Data Classification &amp; Storage Inventory
            </h2>
            <p className="abh-prose">
              The following audit details every piece of user information handled by Abhyas, where
              it is stored, and where it may be transmitted:
            </p>

            <div className="abh-table-wrap">
              <table className="abh-data-table" aria-label="Data Classification Inventory">
                <thead>
                  <tr>
                    <th scope="col">Data Element</th>
                    <th scope="col">Sensitivity</th>
                    <th scope="col">Storage Location</th>
                    <th scope="col">Retention / Lifecycle</th>
                    <th scope="col">Destination</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Provider API Keys</strong>
                    </td>
                    <td>Critical</td>
                    <td>
                      IndexedDB (<code>settings</code>), optional WebCrypto AES-GCM encryption
                    </td>
                    <td>
                      Persistent locally until deleted; decrypted only in memory during session
                    </td>
                    <td>User-selected provider origin only</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Resumes &amp; Job Descriptions</strong>
                    </td>
                    <td>High (PII)</td>
                    <td>
                      IndexedDB (<code>documents</code>)
                    </td>
                    <td>Persistent locally; user can delete at any time</td>
                    <td>User-selected provider (in structured prompts)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Structured Candidate Profile</strong>
                    </td>
                    <td>High</td>
                    <td>
                      IndexedDB (<code>profiles</code>)
                    </td>
                    <td>Persistent locally; exported or purged on demand</td>
                    <td>User-selected provider (in prompt context)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Spoken Audio (Push-to-Talk)</strong>
                    </td>
                    <td>High</td>
                    <td>Browser SpeechRecognition API (ephemeral memory)</td>
                    <td>Ephemeral buffer; discarded immediately after transcription</td>
                    <td>Browser speech recognition service</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Interview Transcripts &amp; Answers</strong>
                    </td>
                    <td>High</td>
                    <td>
                      IndexedDB (<code>turns</code>, <code>sessions</code>)
                    </td>
                    <td>Stored in local database; never uploaded to Abhyas servers</td>
                    <td>User-selected provider (for scoring)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Evaluation Feedback &amp; Scores</strong>
                    </td>
                    <td>Medium</td>
                    <td>
                      IndexedDB (<code>evaluations</code>, <code>skillStats</code>)
                    </td>
                    <td>Stored in local database</td>
                    <td>Local client only</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Application Settings &amp; Theme</strong>
                    </td>
                    <td>Low</td>
                    <td>
                      IndexedDB (<code>settings</code>)
                    </td>
                    <td>Persistent locally</td>
                    <td>Local client only</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Allowed Outbound Destinations */}
          <section className="abh-content-section" aria-labelledby="egress-heading">
            <h2 id="egress-heading" className="abh-content-h2">
              3. Outbound Network Allowlist
            </h2>
            <p className="abh-prose">
              In strict accordance with our Content Security Policy (CSP), network requests from
              Abhyas are cryptographically restricted to this explicit allowlist:
            </p>

            <div className="abh-table-wrap">
              <table className="abh-data-table" aria-label="Network Destinations Allowlist">
                <thead>
                  <tr>
                    <th scope="col">Destination Origin</th>
                    <th scope="col">Protocol</th>
                    <th scope="col">When Used</th>
                    <th scope="col">Data Transmitted</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>
                        Own Origin (<code>&apos;self&apos;</code>)
                      </strong>
                    </td>
                    <td>HTTPS</td>
                    <td>Always</td>
                    <td>Application bundle, self-hosted fonts, static icons, Web Workers</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>
                        <code>https://generativelanguage.googleapis.com</code>
                      </strong>
                    </td>
                    <td>HTTPS</td>
                    <td>When Gemini provider is selected</td>
                    <td>Prompts (candidate profile context, questions, candidate answers)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>
                        <code>https://api.openai.com</code>
                      </strong>
                    </td>
                    <td>HTTPS</td>
                    <td>When OpenAI provider is selected</td>
                    <td>Prompts (candidate profile context, questions, candidate answers)</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>
                        <code>http://localhost:*</code>, <code>http://127.0.0.1:*</code>
                      </strong>
                    </td>
                    <td>HTTP</td>
                    <td>When local Ollama or OpenAI-compatible runner is active</td>
                    <td>Prompts (local loopback on your device only)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Storage, Voice, and Deletion Controls */}
          <section className="abh-content-section" aria-labelledby="controls-heading">
            <h2 id="controls-heading" className="abh-content-h2">
              4. Storage, Voice Recognition &amp; Deletion
            </h2>
            <div className="abh-prose">
              <h3 className="abh-content-h3">Data Deletion</h3>
              <p>
                You retain complete sovereign ownership of your data. You can export a full JSON
                archive of your profiles, turns, and evaluation histories at any time from Settings,
                or click <strong>&quot;Delete all data&quot;</strong> to instantly purge the entire
                IndexedDB database from your browser.
              </p>

              <h3 className="abh-content-h3">Voice Recognition Privacy</h3>
              <p>
                Push-to-talk audio is captured through the standard Web Speech API. Audio buffers
                are kept solely in browser memory during capture and are discarded as soon as the
                transcribed text is returned. You have the opportunity to review and edit any
                transcription before it is submitted. If you prefer not to use speech, text mode
                offers identical functionality.
              </p>

              <h3 className="abh-content-h3">Company Research &amp; Static Packs</h3>
              <p>
                Company research packs in Abhyas are precompiled, static JSON bundles verified
                during our build process. Selecting a company does not contact that company, nor
                does it send telemetry to any third party.
              </p>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
