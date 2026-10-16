// FR-033, ADR-019, design.md section 8: PG-01 Landing Page built strictly to the approved canvas.
import { useState, useEffect } from "react";
import { Mascot } from "../../components/Mascot";
import { PublicHeader } from "./PublicHeader";
import { PublicFooter } from "./PublicFooter";

export function LandingPage() {
  const [targetAppUrl, setTargetAppUrl] = useState("/app/setup/ai");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const hasExisting =
          localStorage.getItem("abhyas_active_profile") ||
          localStorage.getItem("abhyas_has_completed_setup") ||
          localStorage.getItem("abhyas_provider");
        if (hasExisting) {
          setTargetAppUrl("/app/home");
        }
      } catch {
        // Safe fallback
      }
    }
  }, []);

  return (
    <div className="abh-public-page">
      {/* 1. Header */}
      <PublicHeader currentPath="/" />

      <main id="main-content">
        {/* 2. Hero Band (Ink with Dotted Grid) */}
        <section
          className="abh-band abh-hero-band abh-dotted-grid"
          data-band="ink"
          aria-label="Introduction"
        >
          <div className="abh-public-container abh-hero-layout">
            <div>
              <span className="abh-bracket-label">&#123; Private AI Interview Practice &#125;</span>
              <h1 className="abh-hero-headline">
                PRACTICE INTERVIEWS WITH PRIVATE{" "}
                <span className="abh-accent-word">
                  AI
                  <span className="abh-cursor" aria-hidden="true">
                    _
                  </span>
                </span>
              </h1>
              <p className="abh-hero-promise">
                Private, realistic voice interview practice with honest scoring that stays on your
                device.
              </p>

              <div className="abh-hero-cta-group">
                <a href={targetAppUrl} className="abh-hero-cta-btn">
                  Start practice
                </a>
                <span className="abh-hand-note" aria-hidden="true">
                  No sign up. Your data. Your device.
                </span>
              </div>
            </div>

            {/* Mascot Collage */}
            <div className="abh-mascot-collage" aria-label="Abhyas mascot visual illustration">
              <div className="abh-orange-disc" aria-hidden="true" />
              <div className="abh-mascot-wrapper">
                <Mascot
                  size="hero"
                  face="ready"
                  alt="Pixel mascot: a retro computer monitor with a smiling face"
                />
              </div>

              {/* Pixel Dissolve */}
              <div className="abh-pixel-dissolve" aria-hidden="true">
                <div className="abh-dissolve-row">
                  <span className="abh-pixel-square" />
                  <span className="abh-pixel-square accent" />
                  <span className="abh-pixel-square" />
                </div>
                <div className="abh-dissolve-row">
                  <span className="abh-pixel-square accent" />
                  <span className="abh-pixel-square" />
                </div>
                <div className="abh-dissolve-row">
                  <span className="abh-pixel-square accent" />
                </div>
              </div>

              {/* Sticky Note */}
              <div className="abh-sticky-note" aria-hidden="true">
                LOCAL-FIRST // 0 TELEMETRY
              </div>

              {/* Code Box */}
              <div className="abh-code-box" aria-hidden="true">
                &gt; abhyas.prepare()
                <br />
                &gt; ready
              </div>
            </div>
          </div>
        </section>

        {/* 3. Ticker Band */}
        <div className="abh-ticker-strip" aria-hidden="true">
          <div className="abh-ticker-track">
            <span className="abh-ticker-item">
              VOICE &amp; TEXT EQUALITY <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              ZERO TELEMETRY <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              100% PRIVATE <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              HONEST SCORING <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              WORKS OFFLINE <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              SELF-HOSTED FONTS <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              MIT LICENSED <span className="abh-ticker-sep" />
            </span>
            {/* Repeated for seamless loop */}
            <span className="abh-ticker-item">
              VOICE &amp; TEXT EQUALITY <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              ZERO TELEMETRY <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              100% PRIVATE <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              HONEST SCORING <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              WORKS OFFLINE <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              SELF-HOSTED FONTS <span className="abh-ticker-sep" />
            </span>
            <span className="abh-ticker-item">
              MIT LICENSED <span className="abh-ticker-sep" />
            </span>
          </div>
        </div>

        {/* 4. Why Choose Us */}
        <section
          id="why-choose-us"
          className="abh-band"
          data-band="ink"
          aria-labelledby="why-heading"
        >
          <div className="abh-public-container">
            <span className="abh-bracket-label">&#123; Why choose us &#125;</span>
            <h2 id="why-heading" className="abh-section-heading">
              BUILT FOR REAL PROGRESS
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h2>

            <div className="abh-features-grid">
              <div className="abh-feature-card">
                <span className="abh-feature-num">01 // SPEED</span>
                <h3 className="abh-feature-title">Fast start</h3>
                <p className="abh-feature-desc">
                  Jump straight into realistic practice in under two minutes. No account creation,
                  no email verification, and no payment walls.
                </p>
              </div>

              <div className="abh-feature-card">
                <span className="abh-feature-num">02 // PSYCHOLOGICAL SAFETY</span>
                <h3 className="abh-feature-title">Safe space</h3>
                <p className="abh-feature-desc">
                  Practice high-stakes behavioral and system design questions in private comfort
                  without judgment, awkward pauses, or fear of failure.
                </p>
              </div>

              <div className="abh-feature-card">
                <span className="abh-feature-num">03 // ACTIONABLE FEEDBACK</span>
                <h3 className="abh-feature-title">Track progress</h3>
                <p className="abh-feature-desc">
                  Honest, grounded rubric scoring across technical depth, communication clarity, and
                  delivery pace with concrete rewrites.
                </p>
              </div>

              <div className="abh-feature-card">
                <span className="abh-feature-num">04 // VERIFIABLE SOVEREIGNTY</span>
                <h3 className="abh-feature-title">Private and local</h3>
                <p className="abh-feature-desc">
                  Your resume, answers, and audio never touch our servers. Everything stays in your
                  browser&apos;s IndexedDB or runs completely offline.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. The Experience on Paper */}
        <section
          id="experience"
          className="abh-band"
          data-band="paper"
          aria-labelledby="exp-heading"
        >
          <div className="abh-public-container">
            <span className="abh-bracket-label">&#123; The experience &#125;</span>
            <h2 id="exp-heading" className="abh-section-heading">
              PRACTICE THAT FEELS LIKE THE REAL THING
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h2>

            <div className="abh-experience-content">
              {/* Mockup */}
              <div className="abh-mockup-wrapper">
                <div className="abh-floating-tag">
                  Works offline once a local model is downloaded
                </div>
                <div
                  className="abh-device-laptop"
                  aria-label="Interactive interview interface mockup"
                >
                  <div className="abh-laptop-screen">
                    <div className="abh-mockup-interviewer-row">
                      <Mascot
                        size="card"
                        face="speaking"
                        ariaHidden={true}
                        style={{ width: "64px", height: "54px" }}
                      />
                      <div>
                        <span className="abh-mockup-badge">
                          Senior Staff Interviewer // Speaking
                        </span>
                        <div className="abh-mockup-question">
                          &quot;Can you describe a challenging technical trade-off you had to make
                          in your recent system architecture?&quot;
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        paddingTop: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-text)",
                        }}
                      >
                        [PUSH TO TALK]
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        Live microphone speech recognition active...
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Honest Feature List */}
              <div>
                <ul className="abh-experience-bullets">
                  <li className="abh-experience-item">
                    <span className="abh-check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Voice push-to-talk &amp; real-time subtitles:</strong> Natural
                      conversational rhythm with instant editable transcription.
                    </span>
                  </li>
                  <li className="abh-experience-item">
                    <span className="abh-check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Full voice and text equality:</strong> Everything you can do by
                      speaking, you can do by typing.
                    </span>
                  </li>
                  <li className="abh-experience-item">
                    <span className="abh-check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Dynamic follow-up questions:</strong> Probes depth and detects vague
                      responses just like experienced human interviewers.
                    </span>
                  </li>
                  <li className="abh-experience-item">
                    <span className="abh-check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>Top three actionable fixes first:</strong> Clear, prioritized
                      takeaways so you know exactly where to improve next.
                    </span>
                  </li>
                </ul>

                <a href="/guide/keys" className="abh-boxed-link">
                  Need an API key or prefer running local models? Read our setup guide →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 6. The Facts */}
        <section className="abh-band" data-band="ink" aria-labelledby="facts-heading">
          <div className="abh-public-container">
            <span className="abh-bracket-label">&#123; The facts &#125;</span>
            <h2 id="facts-heading" className="abh-section-heading">
              VERIFIABLE GUARANTEES
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h2>

            <div className="abh-facts-grid">
              <div className="abh-fact-box">
                <span className="abh-fact-numeral">0</span>
                <span className="abh-fact-caption">ACCOUNTS NEEDED</span>
                <p className="abh-fact-detail">
                  No signups, no passwords, no email collection, and no tracking cookies.
                </p>
              </div>

              <div className="abh-fact-box">
                <span className="abh-fact-numeral">0</span>
                <span className="abh-fact-caption">RESUMES SENT TO OUR SERVERS</span>
                <p className="abh-fact-detail">
                  All PDF and Word documents are parsed strictly inside your browser via
                  WebAssembly.
                </p>
              </div>

              <div className="abh-fact-box">
                <span className="abh-fact-numeral">MIT</span>
                <span className="abh-fact-caption">OPEN SOURCE LICENSE</span>
                <p className="abh-fact-detail">
                  Inspect every line of code, verify network egress, or self-host your own instance.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. How It Works on Paper */}
        <section
          id="how-it-works"
          className="abh-band"
          data-band="paper"
          aria-labelledby="steps-heading"
        >
          <div className="abh-public-container">
            <span className="abh-bracket-label">&#123; How it works &#125;</span>
            <h2 id="steps-heading" className="abh-section-heading">
              FOUR STEPS TO PREPARATION
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h2>

            <div className="abh-steps-grid">
              <div className="abh-step-card">
                <span className="abh-step-number">01</span>
                <h3 className="abh-step-title">Connect your AI</h3>
                <p className="abh-step-desc">
                  Enter your Google Gemini or OpenAI API key, or connect to a local runner. Keys
                  stay strictly in your browser.
                </p>
              </div>

              <div className="abh-step-card">
                <span className="abh-step-number">02</span>
                <h3 className="abh-step-title">Add your profile</h3>
                <p className="abh-step-desc">
                  Upload or paste your resume and target job role. Skills and experience are parsed
                  locally in milliseconds.
                </p>
              </div>

              <div className="abh-step-card">
                <span className="abh-step-number">03</span>
                <h3 className="abh-step-title">Choose your session</h3>
                <p className="abh-step-desc">
                  Select question difficulty, interview focus, interviewer style, and choose voice
                  push-to-talk or text mode.
                </p>
              </div>

              <div className="abh-step-card">
                <span className="abh-step-number">04</span>
                <h3 className="abh-step-title">Practice &amp; improve</h3>
                <p className="abh-step-desc">
                  Answer realistic questions, receive follow-ups, and review rubric scores with
                  concrete, grounded rewrites.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section id="faq" className="abh-band" data-band="ink" aria-labelledby="faq-heading">
          <div className="abh-public-container">
            <span className="abh-bracket-label">&#123; Common questions &#125;</span>
            <h2 id="faq-heading" className="abh-section-heading">
              FREQUENTLY ASKED QUESTIONS
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h2>

            <div className="abh-faq-list">
              <details className="abh-faq-item">
                <summary className="abh-faq-summary">
                  <span>Is Abhyas free to use?</span>
                  <span className="abh-faq-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="abh-faq-body">
                  Yes, Abhyas is completely free and open-source under the MIT license. You bring
                  your own API key (BYOK) from providers like Google Gemini (which offers a generous
                  free tier) or OpenAI.
                </div>
              </details>

              <details className="abh-faq-item">
                <summary className="abh-faq-summary">
                  <span>Where does my resume and interview data go?</span>
                  <span className="abh-faq-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="abh-faq-body">
                  Nowhere except directly to your chosen AI provider. Abhyas operates without an
                  intermediary backend server. Your resume text, answers, and evaluations reside
                  strictly inside your browser&apos;s local IndexedDB.
                </div>
              </details>

              <details className="abh-faq-item">
                <summary className="abh-faq-summary">
                  <span>Can I switch between voice and text during an interview?</span>
                  <span className="abh-faq-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="abh-faq-body">
                  Yes. Voice and text are equal first-class citizens. You can speak your answer
                  using push-to-talk, edit the transcribed text before submitting, or switch
                  entirely to typing at any point.
                </div>
              </details>

              <details className="abh-faq-item">
                <summary className="abh-faq-summary">
                  <span>Does Abhyas work completely offline?</span>
                  <span className="abh-faq-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="abh-faq-body">
                  Yes, once the static web assets are loaded, you can run drills with question banks
                  offline. Furthermore, connecting to a local Ollama or OpenAI-compatible server on
                  your machine allows complete interview sessions with zero internet connection.
                </div>
              </details>

              <details className="abh-faq-item">
                <summary className="abh-faq-summary">
                  <span>How are my API keys protected?</span>
                  <span className="abh-faq-icon" aria-hidden="true">
                    +
                  </span>
                </summary>
                <div className="abh-faq-body">
                  API keys are stored exclusively in your browser&apos;s local IndexedDB with
                  optional WebCrypto AES-GCM passphrase encryption. They are never sent to any
                  Abhyas server, never placed in URLs, and never logged.
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* 9. Closing CTA */}
        <section
          className="abh-band abh-closing-cta-band"
          data-band="ink"
          aria-labelledby="cta-heading"
        >
          <div className="abh-public-container">
            <h2 id="cta-heading" className="abh-closing-heading">
              Practice today. Be ready tomorrow
              <span className="abh-cursor" aria-hidden="true">
                _
              </span>
            </h2>
            <p className="abh-closing-sub">
              Free, open-source, and completely private interview practice.
            </p>
            <a href={targetAppUrl} className="abh-hero-cta-btn">
              Start practice
            </a>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <PublicFooter />
    </div>
  );
}
