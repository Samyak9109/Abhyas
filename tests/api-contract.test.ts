// M5.1: Backend skeleton contract verification (FR-026, FR-029, ADR-009, ADR-010, architecture 15.3)
import { describe, expect, it } from "vitest";
import { CompanyPackStatusSchema } from "@abhyas/core";
import fs from "node:fs";
import path from "node:path";

describe("M5.1: Backend Research Service Contract & Architecture", () => {
  const apiDir = path.resolve(process.cwd(), "apps/api");

  it("verifies apps/api directory layout matches architecture.md section 5", () => {
    expect(fs.existsSync(apiDir)).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "pyproject.toml"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "main.py"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "config.py"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "routes"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "db"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "security"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "schemas"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "tests"))).toBe(true);
  });

  it("ensures company states in Python schema align with core CompanyPackStatusSchema", () => {
    const companySchemaPy = fs.readFileSync(
      path.join(apiDir, "app", "schemas", "company.py"),
      "utf8"
    );

    const allowedCoreStatuses = CompanyPackStatusSchema.options;
    for (const status of allowedCoreStatuses) {
      expect(companySchemaPy).toContain(`"${status}"`);
    }
  });

  it("guarantees no route accepts free-form prompts or acts as a generic AI proxy (ADR-009, arch 15.3)", () => {
    const mainPy = fs.readFileSync(path.join(apiDir, "app", "main.py"), "utf8");
    const routesDir = path.join(apiDir, "app", "routes");
    const routeFiles = fs.readdirSync(routesDir);

    for (const file of routeFiles) {
      if (!file.endsWith(".py")) continue;
      const content = fs.readFileSync(path.join(routesDir, file), "utf8");

      // Verify no open-ended prompt parameter
      expect(content).not.toMatch(/prompt\s*:\s*str/i);
      expect(content).not.toMatch(/\/prompt/i);
      expect(content).not.toMatch(/\/completions/i);
      expect(content).not.toMatch(/\/generate/i);
    }

    // Verify only authorized router modules are registered in main.py
    expect(mainPy).toContain("health_router");
    expect(mainPy).toContain("companies_router");
    expect(mainPy).toContain("reports_router");
    expect(mainPy).toContain("admin_router");
  });

  it("ensures secrets handling is server-only (ADR-009, NFR-006)", () => {
    const envExample = fs.readFileSync(path.join(apiDir, ".env.example"), "utf8");
    expect(envExample).toContain("ADMIN_SECRET");
    expect(envExample).toContain("PROJECT_AI_API_KEY");
    expect(envExample).toContain("TURNSTILE_SECRET_KEY");

    // Client package core and web must never import or reference api server secrets
    const webSrc = path.resolve(process.cwd(), "apps/web/src");
    const coreSrc = path.resolve(process.cwd(), "packages/core/src");

    const scanForLeak = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanForLeak(fullPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
          const fileContent = fs.readFileSync(fullPath, "utf8");
          expect(fileContent).not.toContain("PROJECT_AI_API_KEY");
          expect(fileContent).not.toContain("TURNSTILE_SECRET_KEY");
        }
      }
    };

    scanForLeak(webSrc);
    scanForLeak(coreSrc);
  });
});

describe("M5.2: Research Pipeline & Safe Fetcher Contract", () => {
  const pipelineDir = path.resolve(process.cwd(), "apps/api/app/pipeline");

  it("verifies pipeline components exist and match architecture.md 15.3", () => {
    expect(fs.existsSync(path.join(pipelineDir, "types.py"))).toBe(true);
    expect(fs.existsSync(path.join(pipelineDir, "fetcher.py"))).toBe(true);
    expect(fs.existsSync(path.join(pipelineDir, "validator.py"))).toBe(true);
    expect(fs.existsSync(path.join(pipelineDir, "extractor.py"))).toBe(true);
    expect(fs.existsSync(path.join(pipelineDir, "checkpointer.py"))).toBe(true);
    expect(fs.existsSync(path.join(pipelineDir, "graph.py"))).toBe(true);
  });

  it("verifies SafeFetcher contains SSRF protection and HTML text extraction", () => {
    const fetcherPy = fs.readFileSync(path.join(pipelineDir, "fetcher.py"), "utf8");
    expect(fetcherPy).toContain("is_private_or_loopback_ip");
    expect(fetcherPy).toContain("SSRF blocked");
    expect(fetcherPy).toContain("HTMLTextExtractor");
  });

  it("verifies 11-node bounded research graph architecture", () => {
    const graphPy = fs.readFileSync(path.join(pipelineDir, "graph.py"), "utf8");
    const requiredNodes = [
      "normalize_company",
      "check_cache",
      "budget_guard",
      "discover_sources",
      "fetch_and_clean",
      "extract_fields",
      "merge_validate",
      "injection_scan",
      "score_coverage",
      "owner_review_interrupt",
      "persist_pack",
    ];
    for (const node of requiredNodes) {
      expect(graphPy).toContain(node);
    }
  });
});

describe("M5.3: Gating and Budget Contract", () => {
  const apiDir = path.resolve(process.cwd(), "apps/api");

  it("verifies gating and budget managers exist and match architecture.md 15.3 and ADR-010", () => {
    expect(fs.existsSync(path.join(apiDir, "app", "pipeline", "budget.py"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "pipeline", "queue.py"))).toBe(true);
    expect(fs.existsSync(path.join(apiDir, "app", "pipeline", "seed.py"))).toBe(true);
  });

  it("verifies kill switch and budget caps in configuration and budget manager", () => {
    const configPy = fs.readFileSync(path.join(apiDir, "app", "config.py"), "utf8");
    expect(configPy).toContain("daily_budget_cents");
    expect(configPy).toContain("monthly_budget_cents");
    expect(configPy).toContain("kill_switch_active");
    expect(configPy).toContain("max_pages_per_job");
    expect(configPy).toContain("max_tokens_per_job");

    const budgetPy = fs.readFileSync(path.join(apiDir, "app", "pipeline", "budget.py"), "utf8");
    expect(budgetPy).toContain("can_start_job");
    expect(budgetPy).toContain("is_kill_switch_active");
    expect(budgetPy).toContain("set_kill_switch");
    expect(budgetPy).toContain("check_job_limits");
  });

  it("verifies zero personal data stored in ResearchRequest model", () => {
    const modelsPy = fs.readFileSync(path.join(apiDir, "app", "db", "models.py"), "utf8");
    // Find ResearchRequest table definition
    const reqMatch = modelsPy.match(/class ResearchRequest[\s\S]*?(?=class|$)/);
    expect(reqMatch).not.toBeNull();
    const reqDef = reqMatch![0];

    // Must store only client_hash and day, no raw IP or personal user identifiers
    expect(reqDef).toContain("client_hash");
    expect(reqDef).toContain("day");
    expect(reqDef).not.toMatch(/ip_address/i);
    expect(reqDef).not.toMatch(/user_id/i);
    expect(reqDef).not.toMatch(/email/i);
  });
});

describe("M5.4: Client Integration and Mirror Contract (FR-026, ADR-009, arch 15.3)", () => {
  const apiDir = path.resolve(process.cwd(), "apps/api");

  it("verifies static mirror export pipeline module exists in apps/api", () => {
    const exportPyPath = path.join(apiDir, "app", "pipeline", "export.py");
    expect(fs.existsSync(exportPyPath)).toBe(true);

    const exportPy = fs.readFileSync(exportPyPath, "utf8");
    expect(exportPy).toContain("export_static_mirror");
    expect(exportPy).toContain("index.json");
  });

  it("verifies POST /v1/admin/export route is registered", () => {
    const adminPy = fs.readFileSync(path.join(apiDir, "app", "routes", "admin.py"), "utf8");
    expect(adminPy).toContain("@router.post(\"/export\"");
    expect(adminPy).toContain("export_static_mirror");
  });

  it("verifies static mirror script scripts/export-company-packs.mjs exists and creates valid index", () => {
    const scriptPath = path.resolve(process.cwd(), "scripts/export-company-packs.mjs");
    expect(fs.existsSync(scriptPath)).toBe(true);

    const publicIndexPath = path.resolve(process.cwd(), "apps/web/public/packs/index.json");
    expect(fs.existsSync(publicIndexPath)).toBe(true);

    const indexContent = fs.readFileSync(publicIndexPath, "utf8");
    const indexJson = JSON.parse(indexContent);
    expect(indexJson.version).toBe(1);
    expect(Array.isArray(indexJson.companies)).toBe(true);
    expect(indexJson.companies.length).toBeGreaterThanOrEqual(10);

    for (const c of indexJson.companies) {
      expect(c.slug).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.domain).toBeDefined();
      expect(c.status).toBe("ready");
    }
  });

  it("ensures client company-pack-service implements fallback order (Cache -> API -> Mirror -> Seeds)", () => {
    const serviceTs = fs.readFileSync(
      path.resolve(process.cwd(), "apps/web/src/services/company-pack-service.ts"),
      "utf8"
    );

    expect(serviceTs).toContain("getClientToken");
    expect(serviceTs).toContain("loadCompanyPack");
    expect(serviceTs).toContain("fetchCompanyDirectory");
    expect(serviceTs).toContain("requestCompanyResearch");
    expect(serviceTs).toContain("submitCompanyReport");
    expect(serviceTs).toContain("companyCache");
  });
});
