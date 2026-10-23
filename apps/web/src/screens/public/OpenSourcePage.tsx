// FR-033, ADR-019, design.md section 8: PG-03 Open Source and License Page.
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function OpenSourcePage() {
  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/open-source" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">&#123; Open Source &amp; Licensing &#125;</span>
            <h1 className="abh-content-title">
              OPEN SOURCE &amp; MIT LICENSE
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <p className="abh-content-subtitle">
              Abhyas is free software. We believe critical interview preparation tools should be
              transparent, verifiable, and free from surveillance capitalism.
            </p>
          </header>

          {/* Section 1: MIT License */}
          <section className="abh-content-section" aria-labelledby="license-heading">
            <h2 id="license-heading" className="abh-content-h2">
              1. MIT License
            </h2>
            <div className="abh-diagnostics-box" role="region" aria-label="MIT License Full Text">
              {`MIT License

Copyright (c) 2026 Samyak Jain

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
            </div>

            <div className="abh-prose">
              <h3 className="abh-content-h3">Plain-Language Summary</h3>
              <p>
                The MIT License is one of the most permissive open-source licenses in existence:
              </p>
              <ul>
                <li>
                  <strong>Commercial &amp; Personal Use:</strong> You can run, fork, and build upon
                  Abhyas freely for personal study or commercial purposes.
                </li>
                <li>
                  <strong>Modification &amp; Distribution:</strong> You can modify the code,
                  distribute derivatives, and host your own instances.
                </li>
                <li>
                  <strong>Condition:</strong> You must retain the original copyright notice and MIT
                  license header in copies or substantial portions.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2: Source Code & Contributing */}
          <section className="abh-content-section" aria-labelledby="contrib-heading">
            <h2 id="contrib-heading" className="abh-content-h2">
              2. Source Code &amp; Contributing
            </h2>
            <div className="abh-prose">
              <p>The entire source code for Abhyas is hosted publicly on GitHub:</p>
              <p>
                <a
                  href="https://github.com/Samyak9109/Abhyas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="abh-boxed-link"
                >
                  View repository on GitHub (github.com/Samyak9109/Abhyas) ↗
                </a>
              </p>
              <h3 className="abh-content-h3">Contribution Guidelines</h3>
              <ul>
                <li>
                  <strong>Privacy First:</strong> No PR may add telemetry, analytics, third-party
                  CDNs, or tracking libraries.
                </li>
                <li>
                  <strong>No Dead Code:</strong> All code must trace to a documented requirement ID
                  (FR or NFR) with zero unused exports.
                </li>
                <li>
                  <strong>Accessibility Baseline:</strong> All new UI components must achieve WCAG
                  2.2 AA compliance across both Ink and Paper themes.
                </li>
                <li>
                  <strong>Test Gates:</strong> Run <code>pnpm test</code> and <code>pnpm lint</code>{" "}
                  to verify green CI before submitting a pull request.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3: Trademark Policy */}
          <section className="abh-content-section" aria-labelledby="trademark-heading">
            <h2 id="trademark-heading" className="abh-content-h2">
              3. Trademark Policy
            </h2>
            <div className="abh-prose">
              <p>
                While the software code is MIT licensed, the name{" "}
                <strong>&quot;Abhyas&quot; (अभ्यास)</strong>, the project wordmark, and the{" "}
                <strong>pixel monitor-head interviewer mascot</strong> are protected trademarks of
                Samyak Jain.
              </p>
              <p>
                If you create a public fork or distribution of this software, you are warmly
                encouraged to do so under the MIT license, but you must rename the project and
                replace the official brand logos and mascot artwork so as not to confuse users
                regarding project origin or endorsement.
              </p>
            </div>
          </section>

          {/* Section 4: Third-Party Licenses */}
          <section className="abh-content-section" aria-labelledby="deps-heading">
            <h2 id="deps-heading" className="abh-content-h2">
              4. Third-Party Licenses &amp; Copyleft Prevention
            </h2>
            <div className="abh-prose">
              <p>
                Abhyas strictly prohibits copyleft licenses (GPL, AGPL) in its dependency tree to
                ensure the project remains unencumbered for all users. All runtime dependencies are
                audited via automated license checks in CI:
              </p>
              <ul>
                <li>
                  <strong>React &amp; React DOM:</strong> MIT License
                </li>
                <li>
                  <strong>Vite:</strong> MIT License
                </li>
                <li>
                  <strong>TypeScript:</strong> Apache 2.0 License
                </li>
                <li>
                  <strong>Dexie.js:</strong> Apache 2.0 License
                </li>
                <li>
                  <strong>PDF.js (Mozilla):</strong> Apache 2.0 License
                </li>
                <li>
                  <strong>
                    Self-hosted Fonts (Pixelify Sans, Instrument Sans, JetBrains Mono, Caveat):
                  </strong>{" "}
                  SIL Open Font License (OFL)
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5: Security Contact */}
          <section className="abh-content-section" aria-labelledby="sec-heading">
            <h2 id="sec-heading" className="abh-content-h2">
              5. Security Contact
            </h2>
            <div className="abh-prose">
              <p>
                If you discover a security vulnerability or unauthorized egress risk in Abhyas,
                please submit a confidential report via GitHub Security Advisories or contact the
                maintainer directly through the repository.
              </p>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
