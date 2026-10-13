// NFR-022, ADR-003, phases.md M0.5: License compliance checker.
// Ensures no copyleft (GPL, AGPL) dependencies enter the codebase.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const BANNED_LICENSE_PATTERNS = [
  /\bAGPL\b/i,
  /\bGPL\b/i,
  /\bLGPL\b/i,
  /\bSSPL\b/i,
  /\bCC-BY-NC\b/i,
];

export const ALLOWED_LICENSES = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "CC0-1.0",
  "OFL-1.1",
  "Python-2.0",
  "Unlicense",
  "BlueOak-1.0.0",
  "Public Domain",
]);

/**
 * Evaluates whether a license string is banned.
 */
export function isBannedLicense(licenseStr) {
  if (!licenseStr || typeof licenseStr !== "string") {
    return false;
  }
  return BANNED_LICENSE_PATTERNS.some((pattern) => pattern.test(licenseStr));
}

/**
 * Scans a list of package descriptors { name, version, license } for compliance.
 */
export function auditPackageLicenses(packages) {
  const violations = [];
  const scanned = [];

  for (const pkg of packages) {
    const lic = pkg.license || "UNKNOWN";
    if (isBannedLicense(lic)) {
      violations.push({
        name: pkg.name,
        version: pkg.version,
        license: lic,
        reason: "Contains banned copyleft license (GPL/AGPL)",
      });
    } else {
      scanned.push(pkg);
    }
  }

  return {
    valid: violations.length === 0,
    scannedCount: scanned.length,
    violations,
  };
}

/**
 * Scans installed packages in the monorepo by inspecting package.json manifests in node_modules.
 */
export function auditInstalledDependencies(baseDir = rootDir) {
  const nodeModulesDir = path.join(baseDir, "node_modules");
  const pnpmDir = path.join(nodeModulesDir, ".pnpm");
  const packages = [];
  const seen = new Set();

  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.includes("@")) {
        // Find nested node_modules inside .pnpm/<pkg>/node_modules
        const nestedNm = path.join(pnpmDir, entry.name, "node_modules");
        if (fs.existsSync(nestedNm)) {
          collectPackagesFromDir(nestedNm, packages, seen);
        }
      }
    }
  } else if (fs.existsSync(nodeModulesDir)) {
    collectPackagesFromDir(nodeModulesDir, packages, seen);
  }

  return auditPackageLicenses(packages);
}

function collectPackagesFromDir(dir, packages, seen) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith("@")) {
        // Scoped package
        const scopedEntries = fs.readdirSync(fullPath, { withFileTypes: true });
        for (const scopedEntry of scopedEntries) {
          const pkgJsonPath = path.join(fullPath, scopedEntry.name, "package.json");
          addPackageIfFound(pkgJsonPath, packages, seen);
        }
      } else {
        const pkgJsonPath = path.join(fullPath, "package.json");
        addPackageIfFound(pkgJsonPath, packages, seen);
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
}

function addPackageIfFound(pkgJsonPath, packages, seen) {
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      const key = `${raw.name}@${raw.version}`;
      if (!seen.has(key)) {
        seen.add(key);
        let license = raw.license;
        if (!license && Array.isArray(raw.licenses)) {
          license = raw.licenses.map((l) => l.type || l).join(" OR ");
        } else if (typeof license === "object" && license !== null) {
          license = license.type;
        }
        packages.push({
          name: raw.name,
          version: raw.version,
          license: license || "UNKNOWN",
        });
      }
    } catch {
      // Ignore invalid JSON
    }
  }
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = auditInstalledDependencies(rootDir);

  if (!result.valid) {
    console.error("License check failed! The following GPL/AGPL dependencies were detected:");
    for (const v of result.violations) {
      console.error(`  - ${v.name}@${v.version} (License: ${v.license}) -> ${v.reason}`);
    }
    process.exit(1);
  } else {
    console.log(
      `License check passed: 0 GPL/AGPL dependencies found across ${result.scannedCount} packages.`
    );
    process.exit(0);
  }
}
