// NFR-022, ADR-003, phases.md M0.5: License check verification suite.
// Acceptance criteria: license check blocks GPL and AGPL dependencies.
import { describe, expect, it } from "vitest";
import {
  isBannedLicense,
  auditPackageLicenses,
  auditInstalledDependencies,
} from "../scripts/check-licenses.mjs";

describe("M0.5: License Compliance & Copyleft Prevention (ADR-003, NFR-022)", () => {
  describe("Current Workspace Dependencies", () => {
    it("confirms 0 GPL/AGPL dependencies in the installed monorepo packages", () => {
      const result = auditInstalledDependencies();
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.scannedCount).toBeGreaterThan(50);
    });
  });

  describe("Blocking Copyleft Licenses (Acceptance Criterion)", () => {
    const copyleftLicenses = [
      "GPL-3.0",
      "GPL-2.0-only",
      "GPL-3.0-or-later",
      "AGPL-3.0",
      "AGPL-1.0-only",
      "LGPL-3.0",
      "SSPL-1.0",
      "CC-BY-NC-4.0",
    ];

    for (const license of copyleftLicenses) {
      it(`identifies "${license}" as a banned copyleft license`, () => {
        expect(isBannedLicense(license)).toBe(true);
      });
    }

    it("blocks and fails when a dependency contains GPL or AGPL licenses", () => {
      const testPackages = [
        { name: "permissive-lib", version: "1.0.0", license: "MIT" },
        { name: "apache-lib", version: "2.1.0", license: "Apache-2.0" },
        { name: "gpl-offender", version: "0.5.0", license: "GPL-3.0" },
        { name: "agpl-offender", version: "1.2.0", license: "AGPL-3.0-or-later" },
      ];

      const result = auditPackageLicenses(testPackages);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(2);

      const offenderNames = result.violations.map((v) => v.name);
      expect(offenderNames).toContain("gpl-offender");
      expect(offenderNames).toContain("agpl-offender");

      for (const v of result.violations) {
        expect(v.reason).toContain("Contains banned copyleft license (GPL/AGPL)");
      }
    });

    it("approves permissive licenses (MIT, Apache-2.0, BSD-3-Clause, ISC)", () => {
      const permissiveLicenses = [
        "MIT",
        "Apache-2.0",
        "BSD-2-Clause",
        "BSD-3-Clause",
        "ISC",
        "0BSD",
        "CC0-1.0",
        "OFL-1.1",
      ];

      for (const lic of permissiveLicenses) {
        expect(isBannedLicense(lic)).toBe(false);
      }

      const permissivePackages = permissiveLicenses.map((lic, idx) => ({
        name: `pkg-${idx}`,
        version: "1.0.0",
        license: lic,
      }));

      const result = auditPackageLicenses(permissivePackages);
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.scannedCount).toBe(permissivePackages.length);
    });
  });
});
