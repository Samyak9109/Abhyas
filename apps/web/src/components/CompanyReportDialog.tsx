// FR-026, FR-029, PG-21: Report and request dialogs backed by the research service.
// Allows users to submit research demand and flag incorrect company data directly to the
// service (storing zero personal data), with automatic fallback to prefilled GitHub issues.
import React, { useState, useEffect } from "react";
import type { StorageAdapter } from "@abhyas/core";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Callout } from "./Callout";
import {
  requestCompanyResearch,
  submitCompanyReport,
} from "../services/company-pack-service";

type CompanyReportDialogMode = "report" | "request";

interface CompanyReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: CompanyReportDialogMode | undefined;
  company?:
    | {
        name: string;
        slug: string;
        domain: string;
      }
    | null
    | undefined;
  storage?: StorageAdapter | undefined;
  apiUrl?: string | undefined;
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
  storage,
  apiUrl,
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
  const [reportSuccess, setReportSuccess] = useState(false);

  // Request state
  const [targetName, setTargetName] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [targetNotes, setTargetNotes] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copiedRequest, setCopiedRequest] = useState(false);
  const [requestOpened, setRequestOpened] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // API connectivity & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApiOffline, setIsApiOffline] = useState(false);

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
      setReportSuccess(false);

      setTargetName("");
      setTargetDomain("");
      setTargetNotes("");
      setRequestError(null);
      setCopiedRequest(false);
      setRequestOpened(false);
      setRequestSuccess(false);

      setIsSubmitting(false);
      setIsApiOffline(false);
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
      `_Reported via Abhyas report dialog (no personal data or transcripts included)._`,
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

  const handleSubmitReportApi = async () => {
    if (reason.trim().length < 10) {
      setReportError("Please describe the issue in at least 10 characters.");
      return;
    }
    setReportError(null);
    setIsSubmitting(true);
    try {
      const targetSlug =
        company?.slug ||
        reportCompany
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      const res = await submitCompanyReport(targetSlug, reason.trim(), {
        field: affectedField,
        apiUrl,
      });
      if (res.ok) {
        setReportSuccess(true);
      } else if (res.offline) {
        setIsApiOffline(true);
      } else {
        setReportError(res.error || "Failed to submit report");
      }
    } catch {
      setIsApiOffline(true);
    } finally {
      setIsSubmitting(false);
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
      setRequestError("Please provide a company name (at least 2 characters) before copying.");
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

  const handleSubmitRequestApi = async () => {
    if (targetName.trim().length < 2) {
      setRequestError("Please provide a company name (at least 2 characters).");
      return;
    }
    setRequestError(null);
    setIsSubmitting(true);
    try {
      const slug = targetName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const res = await requestCompanyResearch(slug, {
        domain: targetDomain.trim() || undefined,
        apiUrl,
        storage,
      });
      if (res.ok) {
        setRequestSuccess(true);
      } else if (res.offline) {
        setIsApiOffline(true);
      } else {
        setRequestError(res.error || "Failed to register request");
      }
    } catch {
      setIsApiOffline(true);
    } finally {
      setIsSubmitting(false);
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
        <div
          role="tablist"
          className="abh-tablist"
          aria-label="Report or Request Mode"
          style={{ marginBottom: "var(--space-4)" }}
        >
          <button
            type="button"
            role="tab"
            id="tab-report"
            aria-selected={mode === "report"}
            aria-controls="panel-report"
            className={`abh-tab ${mode === "report" ? "abh-tab--active" : ""}`}
            onClick={() => {
              setMode("report");
              setReportError(null);
            }}
          >
            Report Incorrect Data
          </button>
          <button
            type="button"
            role="tab"
            id="tab-request"
            aria-selected={mode === "request"}
            aria-controls="panel-request"
            className={`abh-tab ${mode === "request" ? "abh-tab--active" : ""}`}
            onClick={() => {
              setMode("request");
              setRequestError(null);
            }}
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
            {reportSuccess ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
                data-testid="report-success-panel"
              >
                <Callout variant="success" title="Report Submitted ✓">
                  Thank you for keeping company data accurate. A report has been registered for{" "}
                  <strong>{activeCompanyName}</strong> and confidence tags will be reviewed.
                </Callout>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                  <Button variant="primary" onClick={onClose} data-testid="report-success-done-btn">
                    Done
                  </Button>
                </div>
              </div>
            ) : reportOpened ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Callout variant="success" title="GitHub issue link opened">
                  Your inaccuracy report has been prefilled on GitHub in a new tab. Please review
                  and submit it to help keep company packs truthful!
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
                  handleSubmitReportApi();
                }}
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
              >
                {/* Target Company Name */}
                {company ? (
                  <div
                    style={{
                      padding: "var(--space-3)",
                      backgroundColor: "var(--surface)",
                      borderRadius: "var(--radius-square)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>Target Pack: </span>
                    <strong style={{ color: "var(--text)" }}>{company.name}</strong> (
                    {company.domain})
                  </div>
                ) : (
                  <div className="abh-form-field">
                    <label htmlFor="report-company-name" className="abh-label">
                      Company Name *
                    </label>
                    <input
                      id="report-company-name"
                      type="text"
                      className="abh-input"
                      value={reportCompany}
                      onChange={(e) => setReportCompany(e.target.value)}
                      placeholder="e.g. Stripe, Google, Datadog"
                      required
                    />
                  </div>
                )}

                {/* Affected Field */}
                <div className="abh-form-field">
                  <label htmlFor="report-affected-field" className="abh-label">
                    Affected Field *
                  </label>
                  <select
                    id="report-affected-field"
                    className="abh-select"
                    value={affectedField}
                    onChange={(e) => setAffectedField(e.target.value)}
                  >
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Inaccuracy Details */}
                <div className="abh-form-field">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <label htmlFor="report-reason" className="abh-label">
                      Inaccuracy Details *
                    </label>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {reason.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="report-reason"
                    className="abh-input"
                    rows={4}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (reportError) setReportError(null);
                    }}
                    placeholder="Describe what is outdated, incorrect, or speculative..."
                    aria-describedby={reportError ? "report-error-msg" : undefined}
                    required
                  />
                  {reportError && (
                    <span
                      id="report-error-msg"
                      role="alert"
                      style={{
                        color: "var(--danger)",
                        fontSize: "12px",
                        marginTop: "var(--space-1)",
                      }}
                    >
                      {reportError}
                    </span>
                  )}
                </div>

                {/* Optional Source Link */}
                <div className="abh-form-field">
                  <label htmlFor="report-source-url" className="abh-label">
                    Verified Public Source Link (optional)
                  </label>
                  <input
                    id="report-source-url"
                    type="url"
                    className="abh-input"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://engineering.company.com/post/..."
                  />
                </div>

                {/* Offline Fallback Callout */}
                {isApiOffline && (
                  <Callout variant="info" title="Offline / GitHub Issue Fallback">
                    The research API is currently unreachable. You can still file this report
                    directly via GitHub without logging in to any proxy:
                  </Callout>
                )}

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
                  are submitted or prefilled on GitHub.
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
                      variant="secondary"
                      onClick={handleOpenReportIssue}
                      data-testid="open-report-issue-btn"
                    >
                      Open GitHub Issue ↗
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                      data-testid="submit-report-api-btn"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Report"}
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
            {requestSuccess ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
                data-testid="request-success-panel"
              >
                <Callout variant="success" title="Requested ✓">
                  Your research request for <strong>{targetName.trim()}</strong> has been
                  registered. Packs are researched and verified based on community demand. No
                  personal data was transmitted.
                </Callout>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                  <Button variant="primary" onClick={onClose} data-testid="request-success-done-btn">
                    Done
                  </Button>
                </div>
              </div>
            ) : requestOpened ? (
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
                  handleSubmitRequestApi();
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
                    placeholder="e.g. Datadog, Figma, Snowflake, Shopify"
                    aria-describedby={requestError ? "request-error-msg" : undefined}
                    required
                  />
                  {requestError && (
                    <span
                      id="request-error-msg"
                      role="alert"
                      style={{
                        color: "var(--danger)",
                        fontSize: "12px",
                        marginTop: "var(--space-1)",
                      }}
                    >
                      {requestError}
                    </span>
                  )}
                </div>

                {/* Company Domain */}
                <div className="abh-form-field">
                  <label htmlFor="request-company-domain" className="abh-label">
                    Website or Careers Page (optional)
                  </label>
                  <input
                    id="request-company-domain"
                    type="text"
                    className="abh-input"
                    value={targetDomain}
                    onChange={(e) => setTargetDomain(e.target.value)}
                    placeholder="e.g. datadoghq.com or https://careers.datadoghq.com"
                  />
                </div>

                {/* Roles / Tech Stack Notes */}
                <div className="abh-form-field">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <label htmlFor="request-target-notes" className="abh-label">
                      Target Engineering Roles / Notes (optional)
                    </label>
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {targetNotes.length}/300
                    </span>
                  </div>
                  <textarea
                    id="request-target-notes"
                    className="abh-input"
                    rows={2}
                    maxLength={300}
                    value={targetNotes}
                    onChange={(e) => setTargetNotes(e.target.value)}
                    placeholder="e.g. Senior Backend / Distributed Systems engineering loop"
                  />
                </div>

                {/* Offline Fallback Callout */}
                {isApiOffline && (
                  <Callout variant="info" title="Offline / GitHub Issue Fallback">
                    The research API is currently unreachable. You can still submit this request
                    directly via GitHub:
                  </Callout>
                )}

                {/* Curation Notice */}
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
                  💡 <strong>Evidenced Curation:</strong> All company packs in Abhyas are authored
                  from publicly documented engineering sources. Community requests help prioritize
                  which packs are researched and verified next. No personal data is included.
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
                      variant="secondary"
                      onClick={handleOpenRequestIssue}
                      data-testid="open-request-issue-btn"
                    >
                      Open GitHub Issue ↗
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                      data-testid="submit-request-api-btn"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Request"}
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
