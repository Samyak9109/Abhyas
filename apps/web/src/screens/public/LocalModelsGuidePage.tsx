// FR-033, FR-022, FR-023, ADR-013, design.md section 8: PG-06 Local Models Guide.
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function LocalModelsGuidePage() {
  const LAST_CHECKED_DATE = "October 2026";

  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/guide/local-models" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">&#123; Local Models &amp; Offline Guide &#125;</span>
            <h1 className="abh-content-title">
              LOCAL MODELS &amp; PRIVATE PRACTICE
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
              Run interview practice 100% offline or with zero cloud egress using in-browser WebGPU
              models or local server engines like Ollama and LM Studio.
            </p>
          </header>

          {/* Key Guarantee Box */}
          <div
            className="abh-code-box"
            style={{ position: "static", margin: "32px 0", maxWidth: "800px" }}
          >
            &gt; ZERO EGRESS GUARANTEE:
            <br />
            &gt; In local mode, zero prompts, resumes, answers or transcripts leave your machine.
            <br />
            &gt; In-browser models are cached in IndexedDB/OPFS; local servers run on loopback (127.0.0.1).
            <br />
            &gt; Completely free and functional offline without an API key.
          </div>

          {/* Section 1: Device Rules & Who Can Run Local Models */}
          <section className="abh-content-section" aria-labelledby="who-can-run-heading">
            <h2 id="who-can-run-heading" className="abh-content-h2">
              1. Device Requirements (PC Only, Text Only)
            </h2>
            <p className="abh-prose">
              Running real language models locally requires desktop-class GPU or CPU compute and
              dedicated system memory. To protect device stability, Abhyas applies two strict rules:
            </p>
            <ul className="abh-prose" style={{ lineHeight: "1.8", paddingLeft: "24px" }}>
              <li>
                <strong>PC Only (Phones Blocked):</strong> Local models are restricted to desktop and
                laptop PCs (Windows, macOS, Linux). Mobile phones and tablets are blocked (FR-022,
                ADR-013) due to thermal throttling, mobile OS aggressive background kills, and lack
                of full WebGPU compute shader pipelines. On phones, please use cloud providers (Gemini
                free tier) or practice in text mode.
              </li>
              <li>
                <strong>Strictly Text-Only:</strong> Local model practice is 100% text-only (FR-022,
                ADR-013). No microphone prompt appears and no speech synthesis services are constructed.
                This reserves 100% of memory bandwidth and GPU compute for inference without audio
                chopping or dropped frames.
              </li>
              <li>
                <strong>WebGPU Browser Support:</strong> For in-browser models, you need a WebGPU-enabled
                browser such as Google Chrome (113+), Microsoft Edge (113+), or Arc.
              </li>
            </ul>
          </section>

          {/* Section 2: Hardware Tiers & Curated Models */}
          <section className="abh-content-section" aria-labelledby="tiers-heading">
            <h2 id="tiers-heading" className="abh-content-h2">
              2. Hardware Tiers &amp; Curated Models
            </h2>
            <p className="abh-prose">
              Abhyas features an automated micro-benchmark that tests token decoding speed on your device
              to recommend an optimal model tier.
            </p>

            <div className="abh-table-wrap">
              <table className="abh-data-table" aria-label="Local Model Hardware Tiers">
                <thead>
                  <tr>
                    <th scope="col">Hardware Tier</th>
                    <th scope="col">Minimum Specs</th>
                    <th scope="col">Curated Model</th>
                    <th scope="col">Download Size</th>
                    <th scope="col">Expected Speed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="abh-status-pill abh-status-ready">Basic</span>
                    </td>
                    <td>8 GB RAM, Integrated GPU / CPU</td>
                    <td>SmolLM2 1.7B / Qwen2.5 1.5B</td>
                    <td>~1.0 GB</td>
                    <td>&lt; 15 tokens/sec</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="abh-status-pill abh-status-ready">Standard</span>
                    </td>
                    <td>16 GB RAM, Modern M1/M2 or GPU</td>
                    <td>Llama 3.2 3B / Qwen2.5 3B</td>
                    <td>~2.0 GB</td>
                    <td>15 – 30 tokens/sec</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="abh-status-pill abh-status-ready">Advanced</span>
                    </td>
                    <td>16+ GB RAM, Dedicated 6GB+ VRAM</td>
                    <td>Llama 3.1 8B / Qwen2.5 7B</td>
                    <td>~4.9 GB</td>
                    <td>30+ tokens/sec</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Two Paths */}
          <section className="abh-content-section" aria-labelledby="paths-heading">
            <h2 id="paths-heading" className="abh-content-h2">
              3. In-Browser WebGPU vs. Local Servers
            </h2>
            <p className="abh-prose">
              Abhyas gives you two ways to practice with local models:
            </p>
            <div className="abh-table-wrap">
              <table className="abh-data-table" aria-label="Local Execution Options">
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    <th scope="col">In-Browser (WebGPU / WebLLM)</th>
                    <th scope="col">Local Server (Ollama / LM Studio)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Installation</strong></td>
                    <td>Zero install: 1-click download in browser</td>
                    <td>Requires installing Ollama or LM Studio app</td>
                  </tr>
                  <tr>
                    <td><strong>Model Formats</strong></td>
                    <td>Pre-quantized GGUF / MLC weights</td>
                    <td>Any model pulled into Ollama or LM Studio</td>
                  </tr>
                  <tr>
                    <td><strong>Execution Speed</strong></td>
                    <td>WebGPU compute shaders</td>
                    <td>Native C++ / CUDA / Metal (often 20-40% faster)</td>
                  </tr>
                  <tr>
                    <td><strong>Cross-Origin (CORS)</strong></td>
                    <td>Not applicable (runs inside browser tab)</td>
                    <td>Requires setting <code>OLLAMA_ORIGINS=&quot;*&quot;</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Ollama Setup & CORS Configuration */}
          <section className="abh-content-section" aria-labelledby="ollama-guide-heading">
            <h2 id="ollama-guide-heading" className="abh-content-h2">
              4. Ollama Setup &amp; CORS Configuration
            </h2>
            <p className="abh-prose">
              Ollama is a popular tool for running models locally. Because Abhyas runs as a web
              application, your browser enforces the <strong>Same-Origin Policy (CORS)</strong>. By default,
              Ollama blocks web browser connections unless the <code>OLLAMA_ORIGINS</code> environment
              variable is configured.
            </p>

            <div className="abh-stepper-card">
              <div className="abh-step-head">
                <span className="abh-step-badge">1</span>
                <h3 className="abh-step-head-title">Install Ollama</h3>
              </div>
              <p className="abh-prose">
                Download and install Ollama from{" "}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-text)" }}
                >
                  ollama.com ↗
                </a>
                .
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">2</span>
                <h3 className="abh-step-head-title">Pull an interview model</h3>
              </div>
              <p className="abh-prose">
                Open your terminal or command prompt and pull a recommended model:
              </p>
              <pre
                className="abh-code-box"
                style={{ position: "static", margin: "12px 0" }}
              >
                <code>ollama pull llama3.2</code>
              </pre>
              <p className="abh-prose" style={{ fontSize: "14px", color: "var(--text-muted)" }}>
                Tip: For lower memory usage, pull <code>qwen2.5:1.5b</code>. For higher quality, pull <code>llama3.1:8b</code>.
              </p>

              <div className="abh-step-head">
                <span className="abh-step-badge">3</span>
                <h3 className="abh-step-head-title">Configure CORS (Cross-Origin Resource Sharing)</h3>
              </div>
              <p className="abh-prose">
                Configure Ollama to allow connections from your browser:
              </p>

              <div style={{ margin: "16px 0" }}>
                <p className="abh-prose"><strong>On Windows:</strong></p>
                <p className="abh-prose" style={{ fontSize: "14px" }}>
                  Option A: Set in terminal before starting:
                </p>
                <pre className="abh-code-box" style={{ position: "static", margin: "8px 0" }}>
                  <code>set OLLAMA_ORIGINS=* &amp;&amp; ollama serve</code>
                </pre>
                <p className="abh-prose" style={{ fontSize: "14px" }}>
                  Option B (Permanent): Open <em>System Properties &gt; Environment Variables</em>, add a
                  User Variable named <code>OLLAMA_ORIGINS</code> with value <code>*</code>, then restart
                  Ollama from the taskbar tray.
                </p>

                <p className="abh-prose" style={{ marginTop: "16px" }}><strong>On macOS:</strong></p>
                <pre className="abh-code-box" style={{ position: "static", margin: "8px 0" }}>
                  <code>launchctl setenv OLLAMA_ORIGINS &quot;*&quot;</code>
                </pre>
                <p className="abh-prose" style={{ fontSize: "14px" }}>
                  After running the command above, quit and reopen Ollama from your Applications folder.
                </p>

                <p className="abh-prose" style={{ marginTop: "16px" }}><strong>On Linux (systemd):</strong></p>
                <pre className="abh-code-box" style={{ position: "static", margin: "8px 0" }}>
                  <code>sudo systemctl edit ollama.service</code>
                </pre>
                <p className="abh-prose" style={{ fontSize: "14px" }}>
                  Add these lines under the <code>[Service]</code> section:
                </p>
                <pre className="abh-code-box" style={{ position: "static", margin: "8px 0" }}>
                  <code>[Service]
Environment=&quot;OLLAMA_ORIGINS=*&quot;</code>
                </pre>
                <p className="abh-prose" style={{ fontSize: "14px" }}>
                  Save and run <code>sudo systemctl daemon-reload &amp;&amp; sudo systemctl restart ollama</code>.
                </p>
              </div>

              <div className="abh-step-head">
                <span className="abh-step-badge">4</span>
                <h3 className="abh-step-head-title">Connect in Abhyas</h3>
              </div>
              <p className="abh-prose">
                Navigate to <strong>AI Setup</strong> in Abhyas, select <strong>&quot;Ollama (local server)&quot;</strong>,
                verify the URL is <code>http://localhost:11434</code>, and click <strong>&quot;Test connection&quot;</strong>.
                Your installed models will auto-populate in the model picker!
              </p>
            </div>
          </section>

          {/* Section 5: LM Studio Setup */}
          <section className="abh-content-section" aria-labelledby="lmstudio-guide-heading">
            <h2 id="lmstudio-guide-heading" className="abh-content-h2">
              5. LM Studio &amp; OpenAI-Compatible Local Servers
            </h2>
            <p className="abh-prose">
              If you use LM Studio, LocalAI, or llama.cpp server, you can connect them via Abhyas&apos;s
              OpenAI-compatible adapter:
            </p>
            <ol className="abh-prose" style={{ lineHeight: "1.8", paddingLeft: "24px" }}>
              <li>
                Open LM Studio, click the <strong>&quot;Local Server&quot;</strong> icon in the sidebar.
              </li>
              <li>
                Load your preferred model and click <strong>&quot;Start Server&quot;</strong> (defaults to port 1234).
              </li>
              <li>
                In the Server Settings pane, ensure the <strong>&quot;Enable CORS&quot;</strong> toggle is turned <strong>ON</strong>.
              </li>
              <li>
                In Abhyas AI Setup, select <strong>&quot;OpenAI-compatible&quot;</strong>, set the Base URL to{" "}
                <code>http://localhost:1234/v1</code>, leave the API key blank, and click <strong>&quot;Test connection&quot;</strong>.
              </li>
            </ol>
          </section>

          {/* Section 6: Honesty & Basic Feedback */}
          <section className="abh-content-section" aria-labelledby="honesty-heading">
            <h2 id="honesty-heading" className="abh-content-h2">
              6. Honesty: What &quot;Basic Feedback&quot; Means
            </h2>
            <p className="abh-prose">
              Abhyas is built on absolute honesty (FR-012, AI-014). Local models under 8 billion
              parameters excel at asking relevant technical questions and checking for keyword-level
              accuracy, but they cannot perform the subtle, multi-dimensional calibration of frontier
              cloud models.
            </p>
            <p className="abh-prose">
              Whenever a session is evaluated by a small local model, your scorecard is clearly labeled
              with a <strong>&quot;Basic Feedback&quot;</strong> badge. We never pretend a 3B model
              produces the same depth as a 70B model. It gives you immediate, private practice
              without misleading claims.
            </p>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
