// FR-026, FR-029, PG-21: Report and request dialogs (interim issue-link variant for Phase 4).
// Allows users to flag incorrect company data or request research for unlisted employers
// via prefilled GitHub issues and clipboard markdown without exposing any personal data.
import React, { useState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Callout } from "./Callout";

type CompanyReportDialogMode = "report" | "request";

interface CompanyReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: CompanyReportDialogMode | undefined;
  company?: {
    name: string;
    slug: string;
    domain: string;
  } | null | undefined;
}

const FIELD_OPTIONS = [
  { value: "overview", label: "Company Overview" },
  { value: "products", label: "Key Products" },
  { value: "techStack", label: "Documented Tech Stack" },
  { value: "values", label: "Core Values & Principles" },
  { value: "interviewProcess", label: "Interview Process" },
  { value: "cultureSignals", label: "Culture Signals" },
  { value: "all", label: "General / Entire Pack" },
  { value: "other", label: "Other / Formatting" },
];

export const CompanyReportDialog: React.FC<CompanyReportDialogProps> = ({
  isOpen,
  onClose,
  initialMode = "report",
  company,
}) => {
  const [mode, setMode] = useState<CompanyReportDialogMode>(initialMode);

  // Report state
  const [reportCompany, setReportCompany] = useState(company?.name ?? "");
  const [affectedField, setAffectedField] = useState("overview");
  const [reason, setReason] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [reportOpened, setReportOpened] = useState(false);

  // Request state
  const [targetName, setTargetName] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [targetNotes, setTargetNotes] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [requestOpened, setRequestOpened] = useState(false);

  // Reset/sync when dialog opens or initial props change
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setReportCompany(company?.name ?? "");
      setReason("");
      setSourceUrl("");
      setReportError(null);
      setCopiedReport(false);
      setReportOpened(false);

      setTargetName("");
      setTargetDomain("");
      setTargetNotes("");
      setRequestError(null);
      setCopiedRequest(false);
      setRequestOpened(false);
    }
  }, [isOpen, initialMode, company]);

  const activeCompanyName = company?.name || reportCompany || "Company";

  // Build Report Markdown Body
  const buildReportBody = () => {
    const slugInfo = company?.slug ? `("${company.slug}", domain: ${company.domain})` : "";
    return [
      `### Company Pack Inaccuracy Report`,
      ``,
      `**Company:** ${activeCompanyName} ${slugInfo}`,
      `**Affected Field:** ${FIELD_OPTIONS.find((f) => f.value === affectedField)?.label || affectedField}`,
      ``,
      `**Explanation of Inaccuracy:**`,
      reason.trim(),
      ``,
      `**Verified Public Source Link:**`,
      sourceUrl.trim() || "_None provided_",
      ``,
      `---`,
      `_Reported via Abhyas interim issue link (no personal data or transcripts included)._`,
    ].join("\n");
  };

  // Build Request Markdown Body
  const buildRequestBody = () => {
    return [
      `### Company Pack Research Request`,
      ``,
      `**Company Name:** ${targetName.trim()}`,
      `**Company Domain / Careers URL:** ${targetDomain.trim() || "_Not specified_"}`,
      ``,
      `**Target Engineering Roles / Notes:**`,
      targetNotes.trim() || "_General software engineering interview loop._",
      ``,
      `---`,
      `_Requested via Abhyas pack directory (no personal data included)._`,
    ].join("\n");
  };

  const handleOpenReportIssue = () => {
    if (reason.trim().length < 10) {
      setReportError("Please describe the issue in at least 10 characters.");
      return;
    }
    setReportError(null);

    const body = buildReportBody();
    const issueUrl = `https://github.com/abhyas/abhyas/issues/new?template=company_pack_report.md&title=${encodeURIComponent(
      `[Company Pack Report] ${activeCompanyName}`
    )}&body=${encodeURIComponent(body)}`;

    window.open(issueUrl, "_blank", "noopener,noreferrer");
    setReportOpened(true);
  };

  const handleCopyReport = async () => {
    if (reason.trim().length < 10) {
      setReportError("Please describe the issue in at least 10 characters before copying.");
      return;
    }
    setReportError(null);
    try {
      await navigator.clipboard.writeText(buildReportBody());
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    } catch {
      setReportError("Could not write to clipboard. You can still open the GitHub issue.");
    }
  };

  const handleOpenRequestIssue = () => {
    if (targetName.trim().length < 2) {
      setRequestError("Please provide a company name (at least 2 characters).");
      return;
    }
    setRequestError(null);

    const body = buildRequestBody();
    const issueUrl = `https://github.com/abhyas/abhyas/issues/new?template=company_pack_request.md&title=${encodeURIComponent(
      `[Company Request] ${targetName.trim()}`
    )}&body=${encodeURIComponent(body)}`;

    window.open(issueUrl, "_blank", "noopener,noreferrer");
    setRequestOpened(true);
  };

  const handleCopyRequest = async () => {
    if (targetName.trim().length < 2) {
      setRequestError("Please provide a company name before copying.");
      return;
    }
    setRequestError(null);
    try {
      await navigator.clipboard.writeText(buildRequestBody());
      setCopiedRequest(true);
      setTimeout(() => setCopiedRequest(false), 3000);
    } catch {
      setRequestError("Could not write to clipboard. You can still open the GitHub issue.");
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "report" ? "Report Incorrect Company Data_" : "Request a Company Pack_"}
    >
      <div className="abh-company-report-dialog" data-testid="company-report-dialog">
        {/* Tab selection */}
        <div role="tablist" className="abh-tablist" aria-label="Report or Request Mode" style={{ marginBottom: "var(--space-4)" }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "report"}
            className="abh-tab"
            onClick={() => setMode("report")}
            id="tab-report"
            aria-controls="panel-report"
          >
            Report Incorrect Data
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "request"}
            className="abh-tab"
            onClick={() => setMode("request")}
            id="tab-request"
            aria-controls="panel-request"
          >
            Request New Company
          </button>
        </div>

        {/* TAB 1: REPORT INCORRECT DATA */}
        {mode === "report" && (
          <div
            id="panel-report"
            role="tabpanel"
            aria-labelledby="tab-report"
            className="abh-tabpanel"
          >
            {reportOpened ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Callout variant="success" title="GitHub issue link opened">
                  Your report has been prefilled on GitHub in a new tab. Thank you for helping keep
                  company packs accurate and evidenced!
                </Callout>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                  <Button variant="primary" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleOpenReportIssue();
                }}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
              >
                {/* Target Company Info */}
                {company ? (
                  <div
                    style={{
                      padding: "var(--space-3) var(--space-4)",
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-square)",
                      fontSize: "13px",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>Target Pack: </span>
                    <strong style={{ color: "var(--text)" }}>{company.name}</strong> ({company.domain})
                  </div>
                ) : (
                  <div className="abh-form-field">
                    <label htmlFor="report-company-input" className="abh-label">
                      Company Name *
                    </label>
                    <input
                      id="report-company-input"
                      type="text"
                      className="abh-input"
                      value={reportCompany}
                      onChange={(e) => setReportCompany(e.target.value)}
                      placeholder="e.g. Google, Amazon, Stripe"
                      required
                    />
                  </div>
                )}

                {/* Field Selector */}
                <div className="abh-form-field">
                  <label htmlFor="report-field-select" className="abh-label">
                    Affected Field *
                  </label>
                  <select
                    id="report-field-select"
                    className="abh-input"
                    value={affectedField}
                    onChange={(e) => setAffectedField(e.target.value)}
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason / Details */}
                <div className="abh-form-field">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor="report-reason" className="abh-label">
                      Inaccuracy Details *
                    </label>
                    <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {reason.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="report-reason"
                    className="abh-input"
                    style={{ height: "100px", resize: "vertical", fontFamily: "var(--font-body)" }}
                    rows={4}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (reportError) setReportError(null);
                    }}
                    placeholder="Describe what is wrong, outdated, or misleading in this company pack..."
                    aria-describedby={reportError ? "report-error-msg" : undefined}
                    required
                  />
                  {reportError && (
                    <span
                      id="report-error-msg"
                      role="alert"
                      style={{ color: "var(--danger)", fontSize: "12px", marginTop: "var(--space-1)" }}
                    >
                      {reportError}
                    </span>
                  )}
                </div>

                {/* Verified Source URL */}
                <div className="abh-form-field">
                  <label htmlFor="report-source-url" className="abh-label">
                    Verified Public Source Link (Optional)
                  </label>
                  <input
                    id="report-source-url"
                    type="url"
                    className="abh-input"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://engineering.company.com/blog/..."
                  />
                </div>

                {/* Privacy Notice */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    padding: "var(--space-2) var(--space-3)",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius-square)",
                    border: "1px dashed var(--line-strong)",
                  }}
                >
                  🔒 <strong>Privacy Assurance:</strong> No user data, resume claims, or interview
                  transcripts are transmitted. Only the selected company, field, and your explanation
                  are prefilled on GitHub.
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "var(--space-2)",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCopyReport}
                    data-testid="copy-report-btn"
                  >
                    {copiedReport ? "Copied ✓" : "Copy Report Text"}
                  </Button>

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <Button type="button" variant="secondary" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleOpenReportIssue}
                      data-testid="open-report-issue-btn"
                    >
                      Open GitHub Issue ↗
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: REQUEST COMPANY PACK */}
        {mode === "request" && (
          <div
            id="panel-request"
            role="tabpanel"
            aria-labelledby="tab-request"
            className="abh-tabpanel"
          >
            {requestOpened ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Callout variant="success" title="GitHub issue request opened">
                  Your company pack request has been prefilled on GitHub in a new tab. You can track
                  progress or contribute evidence directly to the issue!
                </Callout>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                  <Button variant="primary" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleOpenRequestIssue();
                }}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
              >
                {/* Target Company Name */}
                <div className="abh-form-field">
                  <label htmlFor="request-company-name" className="abh-label">
                    Company Name *
                  </label>
                  <input
                    id="request-company-name"
                    type="text"
                    className="abh-input"
                    value={targetName}
                    onChange={(e) => {
                      setTargetName(e.target.value);
                      if (requestError) setRequestError(null);
                    }}
                    placeholder="e.g. Datadog, Figma, Snowflake"
                    aria-describedby={requestError ? "request-error-msg" : undefined}
                    required
                  />
                  {requestError && (
                    <span
                      id="request-error-msg"
                      role="alert"
                      style={{ color: "var(--danger)", fontSize: "12px", marginTop: "var(--space-1)" }}
                    >
                      {requestError}
                    </span>
                  )}
                </div>

                {/* Target Company Domain */}
                <div className="abh-form-field">
                  <label htmlFor="request-company-domain" className="abh-label">
                    Website or Careers Page (Optional)
                  </label>
                  <input
                    id="request-company-domain"
                    type="url"
                    className="abh-input"
                    value={targetDomain}
                    onChange={(e) => setTargetDomain(e.target.value)}
                    placeholder="https://careers.example.com"
                  />
                </div>

                {/* Target Roles or Notes */}
                <div className="abh-form-field">
                  <label htmlFor="request-notes" className="abh-label">
                    Target Roles or Focus Notes (Optional)
                  </label>
                  <textarea
                    id="request-notes"
                    className="abh-input"
                    style={{ height: "80px", resize: "vertical", fontFamily: "var(--font-body)" }}
                    rows={3}
                    maxLength={500}
                    value={targetNotes}
                    onChange={(e) => setTargetNotes(e.target.value)}
                    placeholder="e.g. Backend / Distributed Systems interview loops, core principles..."
                  />
                </div>

                {/* Explanation & Privacy */}
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    padding: "var(--space-2) var(--space-3)",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius-square)",
                    border: "1px dashed var(--line-strong)",
                  }}
                >
                  💡 <strong>Evidenced Curation:</strong> All company packs in Abhyas are authored from
                  publicly documented engineering sources. Community requests help prioritize which
                  packs are researched and verified next. No personal data is included.
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "var(--space-2)",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCopyRequest}
                    data-testid="copy-request-btn"
                  >
                    {copiedRequest ? "Copied ✓" : "Copy Request Text"}
                  </Button>

                  <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <Button type="button" variant="secondary" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleOpenRequestIssue}
                      data-testid="open-request-issue-btn"
                    >
                      Request on GitHub ↗
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
