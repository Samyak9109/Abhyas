// FR-025, FR-026, ADR-008, ADR-010, PG-20: Company directory and detail screen.
// Browse vetted company packs with evidence, sources, and dates.
// Supports status tracking (ready, stale, requested, queued, researching, insufficient_data).
import { useEffect, useMemo, useState } from "react";
import type { CompanyPack, StorageAdapter } from "@abhyas/core";
import { Button } from "../components/Button";
import { Callout } from "../components/Callout";
import { Skeleton } from "../components/Skeleton";
import { CompanyContextPanel } from "../components/CompanyContextPanel";
import { CompanyReportDialog } from "../components/CompanyReportDialog";
import {
  fetchCompanyDirectory,
  getCompanyDirectory,
  loadCompanyPack,
  searchCompanies,
  type CompanyDirectoryItem,
} from "../services/company-pack-service";

interface CompanyDirectoryScreenProps {
  storage: StorageAdapter;
  initialCompanySlug?: string | null;
  onSelectCompanyForSession?: (slug: string) => void;
  onNavigateSessionSetup?: () => void;
  apiUrl?: string;
}

export function CompanyDirectoryScreen({
  storage,
  initialCompanySlug,
  onSelectCompanyForSession,
  onNavigateSessionSetup,
  apiUrl,
}: CompanyDirectoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "high" | "medium">("all");
  const [selectedSlug, setSelectedSlug] = useState<string>(initialCompanySlug ?? "google");
  const [selectedPack, setSelectedPack] = useState<CompanyPack | null>(null);
  const [isSelectedStale, setIsSelectedStale] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [allCompanies, setAllCompanies] = useState<CompanyDirectoryItem[]>(() => getCompanyDirectory());

  // Fetch live or mirror directory on mount / search
  useEffect(() => {
    let mounted = true;
    fetchCompanyDirectory({ apiUrl, query: searchQuery })
      .then((items) => {
        if (mounted && items.length > 0) {
          setAllCompanies(items);
        }
      })
      .catch(() => {
        // Fallback already handled inside fetchCompanyDirectory
      });

    return () => {
      mounted = false;
    };
  }, [apiUrl, searchQuery]);

  // Directory list filtered by coverage
  const companies: CompanyDirectoryItem[] = useMemo(() => {
    const raw = searchQuery.trim() ? searchCompanies(searchQuery) : allCompanies;
    if (coverageFilter === "all") return raw;
    return raw.filter((c) => c.coverage === coverageFilter);
  }, [searchQuery, coverageFilter, allCompanies]);

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.slug === selectedSlug) || null;
  }, [companies, selectedSlug]);

  // Keep selectedSlug in sync if filtered list changes
  useEffect(() => {
    if (companies.length > 0 && !companies.some((c) => c.slug === selectedSlug)) {
      setSelectedSlug(companies[0]!.slug);
    }
  }, [companies, selectedSlug]);

  // Load detailed company pack whenever selectedSlug changes
  useEffect(() => {
    let mounted = true;
    if (!selectedSlug) return;

    setIsLoadingDetail(true);
    loadCompanyPack(selectedSlug, storage)
      .then((res) => {
        if (!mounted) return;
        if (res) {
          setSelectedPack(res.pack);
          setIsSelectedStale(res.isStale);
        } else {
          setSelectedPack(null);
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingDetail(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedSlug, storage]);

  const handlePractice = (slug: string) => {
    if (onSelectCompanyForSession) {
      onSelectCompanyForSession(slug);
    }
    if (onNavigateSessionSetup) {
      onNavigateSessionSetup();
    }
  };

  return (
    <div className="abh-company-directory" data-testid="company-directory-screen">
      <div className="abh-company-dir-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <h1 className="abh-app-title">Company Directory_</h1>
            <p className="abh-prose" style={{ color: "var(--text-muted)", margin: 0 }}>
              Browse vetted company packs. Questions in tailored sessions draw from verified tech
              stacks, corporate values, and publicly documented interview loops (FR-025).
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setIsRequestDialogOpen(true)}
            data-testid="request-company-header-btn"
            style={{ fontSize: "12px", padding: "var(--space-2) var(--space-3)" }}
          >
            + Request a company
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="abh-company-search-bar" role="search" aria-label="Company directory search">
        <div className="abh-company-search-input">
          <label htmlFor="company-search-input" className="sr-only">
            Search companies
          </label>
          <input
            id="company-search-input"
            type="search"
            className="abh-input"
            placeholder="Search company name, domain, tech stack, or alias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="abh-company-filter-pills" role="group" aria-label="Coverage filters">
          <button
            type="button"
            className={`abh-btn abh-btn--secondary ${coverageFilter === "all" ? "abh-btn--primary" : ""}`}
            style={{ padding: "var(--space-2) var(--space-4)", fontSize: "12px" }}
            onClick={() => setCoverageFilter("all")}
          >
            All ({companies.length})
          </button>
          <button
            type="button"
            className={`abh-btn abh-btn--secondary ${coverageFilter === "high" ? "abh-btn--primary" : ""}`}
            style={{ padding: "var(--space-2) var(--space-4)", fontSize: "12px" }}
            onClick={() => setCoverageFilter("high")}
          >
            High coverage
          </button>
          <button
            type="button"
            className={`abh-btn abh-btn--secondary ${coverageFilter === "medium" ? "abh-btn--primary" : ""}`}
            style={{ padding: "var(--space-2) var(--space-4)", fontSize: "12px" }}
            onClick={() => setCoverageFilter("medium")}
          >
            Medium coverage
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      {companies.length === 0 ? (
        <div style={{ marginTop: "var(--space-6)" }}>
          <Callout variant="info" title="No companies found">
            No company packs match &quot;{searchQuery}&quot;. You can clear your search or practice
            with a general session.
          </Callout>
          <div
            style={{
              marginTop: "var(--space-4)",
              display: "flex",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <Button variant="secondary" onClick={() => setSearchQuery("")}>
              Clear search
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsRequestDialogOpen(true)}
              data-testid="request-company-zero-state-btn"
            >
              Request this company pack
            </Button>
            {onNavigateSessionSetup && (
              <Button variant="primary" onClick={onNavigateSessionSetup}>
                Start general session
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="abh-company-dir-layout">
          {/* Left Column: Company Cards List */}
          <nav aria-label="Companies list" className="abh-company-dir-list">
            {companies.map((c) => {
              const isActive = c.slug === selectedSlug;
              return (
                <button
                  type="button"
                  key={c.slug}
                  className={`abh-company-card-item ${isActive ? "abh-company-card-item--active" : ""}`}
                  onClick={() => setSelectedSlug(c.slug)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <div className="abh-company-card-item-top">
                    <span className="abh-company-card-item-name">{c.name}</span>
                    {c.status === "requested" ? (
                      <span
                        className="abh-badge abh-badge--info"
                        data-testid="company-status-requested"
                        style={{ fontSize: "10px" }}
                      >
                        REQUESTED ✓
                      </span>
                    ) : c.status === "queued" ? (
                      <span
                        className="abh-badge abh-badge--warning"
                        data-testid="company-status-queued"
                        style={{ fontSize: "10px" }}
                      >
                        QUEUED
                      </span>
                    ) : c.status === "researching" ? (
                      <span
                        className="abh-badge abh-badge--accent"
                        data-testid="company-status-researching"
                        style={{ fontSize: "10px" }}
                      >
                        RESEARCHING
                      </span>
                    ) : c.status === "insufficient_data" ? (
                      <span
                        className="abh-badge abh-badge--neutral"
                        data-testid="company-status-insufficient"
                        style={{ fontSize: "10px" }}
                      >
                        INSUFFICIENT
                      </span>
                    ) : c.isStale ? (
                      <span
                        className="abh-badge abh-badge--warning"
                        data-testid="company-status-stale"
                        style={{ fontSize: "10px" }}
                      >
                        STALE
                      </span>
                    ) : (
                      <span
                        className="abh-badge abh-badge--success"
                        data-testid="company-status-ready"
                        style={{ fontSize: "10px" }}
                      >
                        READY ✓
                      </span>
                    )}
                  </div>
                  <div className="abh-company-card-item-domain">{c.domain}</div>
                  <div className="abh-company-card-item-meta">
                    <span className="abh-badge abh-badge--neutral" style={{ fontSize: "10px" }}>
                      {c.coverage.toUpperCase()}
                    </span>
                    {c.retrievedAt && (
                      <span
                        className="abh-company-date-tag"
                        style={{ fontSize: "10px", marginLeft: "auto" }}
                      >
                        {c.retrievedAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right Column: Detailed View */}
          <div className="abh-company-detail-pane" aria-live="polite">
            {isLoadingDetail ? (
              <div>
                <Skeleton height="60px" />
                <div style={{ marginTop: "var(--space-4)" }}>
                  <Skeleton height="120px" />
                </div>
                <div style={{ marginTop: "var(--space-4)" }}>
                  <Skeleton height="200px" />
                </div>
              </div>
            ) : selectedPack ? (
              <CompanyContextPanel
                pack={selectedPack}
                isStale={isSelectedStale}
                showPracticeAction={true}
                onPracticeCompany={handlePractice}
              />
            ) : selectedCompany && selectedCompany.status !== "ready" && selectedCompany.status !== "stale" ? (
              <div
                className="abh-company-status-detail-panel"
                data-testid="company-status-detail-panel"
                style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
              >
                <Callout
                  variant={selectedCompany.status === "insufficient_data" ? "warning" : "info"}
                  title={
                    selectedCompany.status === "requested"
                      ? "Requested ✓"
                      : selectedCompany.status === "queued"
                      ? "Queued for Research"
                      : selectedCompany.status === "researching"
                      ? "Currently Researching"
                      : "Insufficient Documented Sources"
                  }
                >
                  {selectedCompany.status === "requested" &&
                    `Research for ${selectedCompany.name} has been requested by the community. Once demand is verified, our automated research pipeline will author and verify this company pack.`}
                  {selectedCompany.status === "queued" &&
                    `${selectedCompany.name} has met the demand threshold and is queued for research pipeline execution within the daily budget.`}
                  {selectedCompany.status === "researching" &&
                    `The research pipeline is currently extracting and validating evidenced sources for ${selectedCompany.name}.`}
                  {selectedCompany.status === "insufficient_data" &&
                    `A previous research run could not find enough publicly documented engineering sources to meet our strict evidence standards. Retry cooldown is in effect.`}
                </Callout>
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  {onNavigateSessionSetup && (
                    <Button variant="primary" onClick={onNavigateSessionSetup}>
                      Start general session (target {selectedCompany.name})
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <Callout variant="warning" title="Pack not loaded">
                Could not load the detailed pack for this company.
              </Callout>
            )}
          </div>
        </div>
      )}

      <CompanyReportDialog
        isOpen={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        initialMode="request"
        storage={storage}
        apiUrl={apiUrl}
      />
    </div>
  );
}
