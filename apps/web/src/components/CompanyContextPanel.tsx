// FR-025, ADR-008: "Company context used" panel component.
// Displays sourced, dated, confidence-labeled company facts, values, tech stack,
// interview process stages, and culture signals with zero unevidenced speculation.
import { useState } from "react";
import type { CompanyPack, EvidenceSource } from "@abhyas/core";
import { Button } from "./Button";
import { Callout } from "./Callout";
import { CompanyReportDialog } from "./CompanyReportDialog";

interface CompanyContextPanelProps {
  pack: CompanyPack;
  isStale?: boolean;
  onClose?: () => void;
  onPracticeCompany?: (slug: string) => void;
  showPracticeAction?: boolean;
}

export function CompanyContextPanel({
  pack,
  isStale = false,
  onClose,
  onPracticeCompany,
  showPracticeAction = false,
}: CompanyContextPanelProps) {
  const verifiedDate = pack.retrievedAt.slice(0, 10);
  const monogram = pack.slug.slice(0, 2).toUpperCase();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  const renderSources = (sources: EvidenceSource[], label = "Sources") => (
    <div className="abh-pack-sources" aria-label={`${label} citations`}>
      <span className="abh-pack-sources-label">[Sourced from]:</span>
      <ul className="abh-pack-sources-list">
        {sources.map((src) => (
          <li key={src.url} className="abh-pack-source-item">
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="abh-pack-source-link"
              title={`${src.title} (retrieved ${src.retrievedAt})`}
            >
              {src.title} ↗
            </a>
            <span className="abh-pack-source-date">({src.retrievedAt.slice(0, 10)})</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="abh-company-context-panel" data-testid="company-context-panel">
      {/* Header */}
      <div className="abh-company-panel-header">
        <div className="abh-company-header-main">
          <div className="abh-company-monogram" aria-hidden="true">
            {monogram}
          </div>
          <div>
            <div className="abh-company-title-row">
              <h2 className="abh-company-name">{pack.name}</h2>
              <span className="abh-company-domain">
                <a
                  href={`https://${pack.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="abh-company-domain-link"
                  aria-label={`Official website: ${pack.domain}`}
                >
                  {pack.domain} ↗
                </a>
              </span>
            </div>

            <div className="abh-company-badges-row">
              <span className="abh-badge abh-badge--neutral">
                {pack.coverage.toUpperCase()} COVERAGE
              </span>
              {isStale ? (
                <span className="abh-badge abh-badge--warning" data-testid="stale-badge">
                  STALE (TTL EXCEEDED)
                </span>
              ) : (
                <span className="abh-badge abh-badge--success" data-testid="verified-badge">
                  VERIFIED ✓
                </span>
              )}
              <span className="abh-company-date-tag">
                Verified: {verifiedDate} ({pack.ttlDays}d TTL)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stale warning notice */}
      {isStale && (
        <div style={{ marginTop: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <Callout variant="warning" title="Company pack is past its validity window">
            This pack was last researched on {verifiedDate} and has exceeded its {pack.ttlDays}-day
            freshness TTL. Some technologies or interview stages may have evolved.
          </Callout>
        </div>
      )}

      {/* Honest AI instruction note */}
      <div className="abh-company-honesty-note">
        <p className="abh-form-hint">
          <strong>How this is used:</strong> During interview generation, verified facts from this
          pack guide company-relevant questions and rubric expectations (FR-025). When no pack is
          selected, the AI is instructed never to hallucinate company facts.
        </p>
      </div>

      <div className="abh-company-sections-grid">
        {/* Overview Section */}
        {pack.overview && (
          <section className="abh-pack-section" aria-labelledby="section-overview">
            <h3 id="section-overview" className="abh-pack-section-title">
              Overview &amp; Mission
            </h3>
            <p className="abh-pack-overview-text">{pack.overview.value}</p>
            {renderSources(pack.overview.sources, "Overview")}
          </section>
        )}

        {/* Tech Stack Section */}
        {pack.techStack && (
          <section className="abh-pack-section" aria-labelledby="section-stack">
            <h3 id="section-stack" className="abh-pack-section-title">
              Documented Tech Stack
            </h3>
            <div className="abh-pack-tags-wrap">
              {pack.techStack.value.map((tech) => (
                <span key={tech} className="abh-pack-tag">
                  {tech}
                </span>
              ))}
            </div>
            {renderSources(pack.techStack.sources, "Tech stack")}
          </section>
        )}

        {/* Core Products */}
        {pack.products && (
          <section className="abh-pack-section" aria-labelledby="section-products">
            <h3 id="section-products" className="abh-pack-section-title">
              Key Products &amp; Platforms
            </h3>
            <div className="abh-pack-tags-wrap">
              {pack.products.value.map((product) => (
                <span key={product} className="abh-pack-product-chip">
                  {product}
                </span>
              ))}
            </div>
            {renderSources(pack.products.sources, "Products")}
          </section>
        )}

        {/* Values & Principles */}
        {pack.values && (
          <section className="abh-pack-section" aria-labelledby="section-values">
            <h3 id="section-values" className="abh-pack-section-title">
              Core Values &amp; Principles
            </h3>
            <div className="abh-pack-values-grid">
              {pack.values.value.map((val) => (
                <div key={val.name} className="abh-pack-value-card">
                  <h4 className="abh-pack-value-name">{val.name}</h4>
                  <p className="abh-pack-value-desc">{val.description}</p>
                </div>
              ))}
            </div>
            {renderSources(pack.values.sources, "Values")}
          </section>
        )}

        {/* Interview Process */}
        {pack.interviewProcess && (
          <section className="abh-pack-section" aria-labelledby="section-process">
            <h3 id="section-process" className="abh-pack-section-title">
              Interview Process Stages
            </h3>
            <ol className="abh-pack-process-list">
              {pack.interviewProcess.value.map((stage) => (
                <li key={stage} className="abh-pack-process-item">
                  {stage}
                </li>
              ))}
            </ol>
            {renderSources(pack.interviewProcess.sources, "Interview process")}
          </section>
        )}

        {/* Culture Signals */}
        {pack.cultureSignals && (
          <section className="abh-pack-section" aria-labelledby="section-culture">
            <h3 id="section-culture" className="abh-pack-section-title">
              Culture &amp; Engineering Signals
            </h3>
            <ul className="abh-pack-signals-list">
              {pack.cultureSignals.value.map((signal) => (
                <li key={signal} className="abh-pack-signal-item">
                  {signal}
                </li>
              ))}
            </ul>
            {renderSources(pack.cultureSignals.sources, "Culture signals")}
          </section>
        )}
      </div>

      {/* Footer Actions */}
      <div className="abh-company-panel-footer">
        <button
          type="button"
          onClick={() => setIsReportDialogOpen(true)}
          className="abh-report-link"
          aria-label={`Report incorrect or outdated data for ${pack.name}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          data-testid="open-report-dialog-btn"
        >
          ⚐ Report incorrect data (GitHub issue)
        </button>

        <div className="abh-company-panel-actions">
          {showPracticeAction && onPracticeCompany && (
            <Button
              variant="primary"
              onClick={() => onPracticeCompany(pack.slug)}
              data-testid="practice-company-btn"
            >
              Practice for {pack.name}
            </Button>
          )}
          {onClose && (
            <Button variant="secondary" onClick={onClose} data-testid="close-panel-btn">
              Close
            </Button>
          )}
        </div>
      </div>

      <CompanyReportDialog
        isOpen={isReportDialogOpen}
        onClose={() => setIsReportDialogOpen(false)}
        initialMode="report"
        company={{ name: pack.name, slug: pack.slug, domain: pack.domain }}
      />
    </div>
  );
}
