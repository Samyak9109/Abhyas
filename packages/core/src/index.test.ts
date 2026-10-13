// FR-N/A, NFR-015, ADR-016: Test framework-free domain core baseline.
import { describe, expect, it } from "vitest";
import { ABHYAS_CORE_VERSION, getCoreInfo } from "./index";

describe("core package", () => {
  it("exports correct version", () => {
    expect(ABHYAS_CORE_VERSION).toBe("0.1.0");
  });

  it("reports as framework-free", () => {
    const info = getCoreInfo();
    expect(info.isFrameworkFree).toBe(true);
    expect(info.name).toBe("@abhyas/core");
  });
});
