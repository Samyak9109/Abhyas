// audit-fix P1-01: Terms & Conditions page — covers acceptable use, liability limits,
// IP, and disclaimer of warranties. Linked from footer and header nav alongside Privacy.
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function TermsPage() {
  return (
    <div className="abh-public-page">
      <PublicHeader currentPath="/terms" />

      <main id="main-content" className="abh-band" data-band="ink">
        <div className="abh-public-container">
          <header className="abh-content-hero">
            <span className="abh-bracket-label">
              &#123; Terms &amp; Conditions &#125;
            </span>
            <h1 className="abh-content-title">
              TERMS OF USE
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h1>
            <p className="abh-content-subtitle">
              Abhyas is a free, open-source, local-first tool. These terms are intentionally plain.
              By using the application you agree to them.
            </p>
            <p className="abh-content-subtitle" style={{ fontSize: "13px", marginTop: "8px" }}>
              <strong>Effective date:</strong> 2026-01-01 &nbsp;·&nbsp;{" "}
              <strong>Last updated:</strong> 2026-11-04
            </p>
          </header>

          {/* 1. Acceptance */}
          <section className="abh-content-section" aria-labelledby="acceptance-heading">
            <h2 id="acceptance-heading" className="abh-content-h2">
              1. Acceptance of Terms
            </h2>
            <div className="abh-prose">
              <p>
                By accessing or using Abhyas (&ldquo;the Application&rdquo;), you agree to be
                bound by these Terms of Use (&ldquo;Terms&rdquo;). If you do not agree, do not
                use the Application.
              </p>
              <p>
                These Terms apply to all versions of Abhyas, whether self-hosted, accessed via a
                managed deployment, or run locally from source.
              </p>
            </div>
          </section>

          {/* 2. Description */}
          <section className="abh-content-section" aria-labelledby="description-heading">
            <h2 id="description-heading" className="abh-content-h2">
              2. What Abhyas Is
            </h2>
            <div className="abh-prose">
              <p>
                Abhyas is an AI-assisted interview practice tool. It runs entirely in your browser.
                Your data — resumes, job descriptions, interview transcripts, API keys, and
                evaluation histories — stays on your device and is never transmitted to Abhyas
                servers. See the{" "}
                <a href="/privacy">Privacy Architecture page</a> for the complete technical audit.
              </p>
              <p>
                Abhyas connects to third-party AI providers (Google Gemini, OpenAI, or a local
                Ollama instance) only on your explicit instruction using credentials you supply.
                Abhyas has no affiliation with and is not endorsed by any of these providers.
              </p>
            </div>
          </section>

          {/* 3. Acceptable Use */}
          <section className="abh-content-section" aria-labelledby="acceptable-use-heading">
            <h2 id="acceptable-use-heading" className="abh-content-h2">
              3. Acceptable Use
            </h2>
            <div className="abh-prose">
              <p>You may use Abhyas to:</p>
              <ul>
                <li>Practice and prepare for job interviews in a private, offline-capable environment.</li>
                <li>Experiment with AI-assisted feedback on your own answers and profile.</li>
                <li>Modify, fork, and self-host the application under the MIT License.</li>
              </ul>
              <p>You may <strong>not</strong> use Abhyas to:</p>
              <ul>
                <li>
                  <strong>Cheat in live employer interviews.</strong> Abhyas is a practice tool.
                  Using it to generate real-time answers during an actual interview is deceptive
                  and prohibited. Any such use is entirely your responsibility.
                </li>
                <li>
                  Circumvent, disable, or interfere with any security features, rate limits, or
                  content policies of the third-party AI providers you connect.
                </li>
                <li>
                  Resell access to Abhyas under a different brand without complying with the MIT
                  License and the separate Trademark Policy (see section 7).
                </li>
                <li>
                  Use the Application in any manner that violates applicable laws or regulations in
                  your jurisdiction.
                </li>
              </ul>
            </div>
          </section>

          {/* 4. Disclaimer of Warranties */}
          <section className="abh-content-section" aria-labelledby="warranty-heading">
            <h2 id="warranty-heading" className="abh-content-h2">
              4. Disclaimer of Warranties
            </h2>
            <div className="abh-prose">
              <p>
                THE APPLICATION IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
                WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
                WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT.
              </p>
              <p>
                Abhyas does not guarantee that the AI feedback you receive is accurate, complete,
                unbiased, or suitable for any particular employer or role. AI-generated evaluations
                are practice aids — they are not professional career advice.
              </p>
              <p>
                Abhyas does not guarantee uninterrupted or error-free operation, nor compatibility
                with every browser, device, or AI provider configuration.
              </p>
            </div>
          </section>

          {/* 5. Limitation of Liability */}
          <section className="abh-content-section" aria-labelledby="liability-heading">
            <h2 id="liability-heading" className="abh-content-h2">
              5. Limitation of Liability
            </h2>
            <div className="abh-prose">
              <p>
                TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, THE DEVELOPER (SAMYAK JAIN)
                SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, LOSS OF EMPLOYMENT
                OPPORTUNITY, OR ANY HARM ARISING FROM YOUR USE OR INABILITY TO USE THE APPLICATION.
              </p>
              <p>
                Because Abhyas processes all data locally on your device, the developer has no
                access to and therefore no liability for any data you store, any API keys you
                configure, or any prompts you send to third-party AI providers.
              </p>
              <p>
                Your total recourse against the developer for any claim arising from these Terms
                is limited to the amount you paid to use the Application — which, for the
                open-source version, is zero.
              </p>
            </div>
          </section>

          {/* 6. Third-Party Services */}
          <section className="abh-content-section" aria-labelledby="third-party-heading">
            <h2 id="third-party-heading" className="abh-content-h2">
              6. Third-Party AI Providers
            </h2>
            <div className="abh-prose">
              <p>
                When you configure an API key and select a provider (Google Gemini, OpenAI, or a
                local runner), your data is transmitted directly from your browser to that
                provider under <em>their</em> terms of service and privacy policy, not Abhyas&apos;s.
                You are responsible for reviewing and complying with those terms.
              </p>
              <p>
                Abhyas does not store, log, or inspect the contents of any prompt or completion
                exchanged with a third-party provider.
              </p>
            </div>
          </section>

          {/* 7. Intellectual Property */}
          <section className="abh-content-section" aria-labelledby="ip-heading">
            <h2 id="ip-heading" className="abh-content-h2">
              7. Intellectual Property &amp; Trademark
            </h2>
            <div className="abh-prose">
              <p>
                The Abhyas source code is released under the{" "}
                <strong>MIT License</strong>. You may use, copy, modify, and distribute it freely
                subject to that license&apos;s conditions.
              </p>
              <p>
                The name <strong>&ldquo;Abhyas&rdquo;</strong> and the pixel monitor-head mascot
                are trademarks of Samyak Jain. Forks and derivative works must use a different
                name and must not reproduce the mascot artwork without written permission. See{" "}
                <code>TRADEMARK.md</code> in the repository for the full policy.
              </p>
            </div>
          </section>

          {/* 8. Changes */}
          <section className="abh-content-section" aria-labelledby="changes-heading">
            <h2 id="changes-heading" className="abh-content-h2">
              8. Changes to These Terms
            </h2>
            <div className="abh-prose">
              <p>
                These Terms may be updated from time to time. The effective date at the top of
                this page will reflect the latest revision. Continued use of the Application after
                a revision constitutes acceptance of the updated Terms. Material changes will be
                noted in the{" "}
                <a href="/roadmap">Roadmap &amp; Changelog</a>.
              </p>
            </div>
          </section>

          {/* 9. Governing Law */}
          <section className="abh-content-section" aria-labelledby="law-heading">
            <h2 id="law-heading" className="abh-content-h2">
              9. Governing Law
            </h2>
            <div className="abh-prose">
              <p>
                These Terms are governed by the laws of India, without regard to conflict-of-law
                principles. Any disputes that cannot be resolved informally will be subject to the
                exclusive jurisdiction of courts in India.
              </p>
            </div>
          </section>

          {/* 10. Contact */}
          <section className="abh-content-section" aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="abh-content-h2">
              10. Contact
            </h2>
            <div className="abh-prose">
              <p>
                Questions about these Terms? Open an issue or discussion on the{" "}
                <a
                  href="https://github.com/Samyak9109/Abhyas"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub repository ↗
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
