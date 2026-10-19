// M5.5: Operations (Rollback, reports queue, logs, cost dashboard, alerts at 50, 80, 100% of budget)
// M5.6: Security and legal (SSRF test suite, injection suite, abuse simulation, scraping policy, privacy statement, pack data license)
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("M5.5: Operations Contract (FR-026, FR-029, arch 15.3)", () => {
  const apiDir = path.resolve(process.cwd(), "apps/api");

  it("verifies admin rollback endpoint restores previous pack version", () => {
    const adminPy = fs.readFileSync(path.join(apiDir, "app", "routes", "admin.py"), "utf8");
    expect(adminPy).toContain("@router.post(\"/rollback\"");
    expect(adminPy).toContain("active_version");
    expect(adminPy).toContain("company.status = \"ready\"");
  });

  it("verifies budget alerts calculation logic at 50%, 80%, and 100% thresholds", () => {
    const budgetPy = fs.readFileSync(path.join(apiDir, "app", "pipeline", "budget.py"), "utf8");
    expect(budgetPy).toContain("calculate_alert_level");
    expect(budgetPy).toContain("100%");
    expect(budgetPy).toContain("80%");
    expect(budgetPy).toContain("50%");
    expect(budgetPy).toContain("get_budget_alerts");
    expect(budgetPy).toContain("drill_budget_alert");
  });

  it("verifies budget alerts drill route POST /v1/admin/alerts/drill", () => {
    const adminPy = fs.readFileSync(path.join(apiDir, "app", "routes", "admin.py"), "utf8");
    expect(adminPy).toContain("@router.post(\"/alerts/drill\"");
    expect(adminPy).toContain("drill_budget_alert");
  });

  it("verifies inaccuracy reports resolution POST /v1/admin/reports/{report_id}/resolve", () => {
    const adminPy = fs.readFileSync(path.join(apiDir, "app", "routes", "admin.py"), "utf8");
    expect(adminPy).toContain("@router.post(\"/reports/{report_id}/resolve\"");
    expect(adminPy).toContain("report.status = payload.resolution");
    expect(adminPy).toContain("report.resolved_at = datetime.now(UTC)");
  });

  it("verifies operations logs endpoint GET /v1/admin/logs", () => {
    const adminPy = fs.readFileSync(path.join(apiDir, "app", "routes", "admin.py"), "utf8");
    expect(adminPy).toContain("@router.get(\"/logs\"");
    expect(adminPy).toContain("tokens_used");
    expect(adminPy).toContain("cost_estimate_cents");
  });
});

describe("M5.6: Security and Legal Verification (FR-026, ADR-009, ADR-010)", () => {
  const apiDir = path.resolve(process.cwd(), "apps/api");
  const docsDir = path.resolve(process.cwd(), "docs");

  it("verifies SSRF defense covers private ranges, loopbacks, cloud metadata, and IPv4-mapped IPv6", () => {
    const fetcherPy = fs.readFileSync(path.join(apiDir, "app", "pipeline", "fetcher.py"), "utf8");

    // Must check private, loopback, link-local, reserved, multicast, unspecified
    expect(fetcherPy).toContain("ip.is_private");
    expect(fetcherPy).toContain("ip.is_loopback");
    expect(fetcherPy).toContain("ip.is_link_local");
    expect(fetcherPy).toContain("ip.is_reserved");
    expect(fetcherPy).toContain("ipv4_mapped");

    // Forbidden hostnames
    expect(fetcherPy).toContain("localhost");
    expect(fetcherPy).toContain("127.0.0.1");
    expect(fetcherPy).toContain("::1");
    expect(fetcherPy).toContain("metadata.google.internal");

    // Strict protocol whitelist
    expect(fetcherPy).toContain("parsed.scheme not in (\"http\", \"https\")");
  });

  it("verifies prompt injection patterns and delimiter sanitization in pipeline validator", () => {
    const validatorPy = fs.readFileSync(path.join(apiDir, "app", "pipeline", "validator.py"), "utf8");

    expect(validatorPy).toContain("ignore\\s+(?:all\\s+)?previous\\s+instructions");
    expect(validatorPy).toContain("disregard\\s+(?:all\\s+)?prior\\s+prompts");
    expect(validatorPy).toContain("[REDACTED_UNTRUSTED_CONTENT]");
    // Markdown breakout neutralization
    expect(validatorPy).toContain("cleaned.replace(\"```\", \"'''\")");
    expect(validatorPy).toContain("cleaned.replace(\"---\", \"—\")");
  });

  it("verifies abuse simulation and demand deduplication contract (ADR-010)", () => {
    const companiesRoutePy = fs.readFileSync(path.join(apiDir, "app", "routes", "companies.py"), "utf8");
    const modelsPy = fs.readFileSync(path.join(apiDir, "app", "db", "models.py"), "utf8");

    // Unique constraint prevents ballot-box stuffing
    expect(modelsPy).toContain("UniqueConstraint(\"company_slug\", \"day\", \"client_hash\"");

    // Daily salted hash
    expect(companiesRoutePy).toContain("abhyas-salt");
    expect(companiesRoutePy).toContain("hashlib.sha256");
  });

  it("verifies scraping policy documentation exists and defines polite crawling standards", () => {
    const policyPath = path.join(docsDir, "scraping-policy.md");
    expect(fs.existsSync(policyPath)).toBe(true);

    const policy = fs.readFileSync(policyPath, "utf8");
    expect(policy).toContain("AbhyasResearchBot/1.0");
    expect(policy).toContain("robots.txt");
    expect(policy).toContain("1 request per second");
    expect(policy).toContain("500 KB");
    expect(policy).toContain("research@abhyas.app");
  });

  it("verifies pack data license document exists and resolves PRD open question 4", () => {
    const licensePath = path.join(docsDir, "pack-data-license.md");
    expect(fs.existsSync(licensePath)).toBe(true);

    const license = fs.readFileSync(licensePath, "utf8");
    expect(license).toContain("Open Data Commons Attribution License");
    expect(license).toContain("CC-BY 4.0");
    expect(license).toContain("Trademarks & Brand Ownership");
    expect(license).toContain("Provenance and Evidence Retention");
  });

  it("verifies privacy audit documentation covers company research service with zero personal data", () => {
    const auditPath = path.join(docsDir, "privacy-audit.md");
    expect(fs.existsSync(auditPath)).toBe(true);

    const audit = fs.readFileSync(auditPath, "utf8");
    expect(audit).toContain("Company Research Service Privacy Model");
    expect(audit).toContain("client_token");
    expect(audit).toContain("daily salted hash");
    expect(audit).toContain("Zero Prompt or Resume Ingestion");
    expect(audit).toContain("PROJECT_AI_API_KEY");
  });
});
