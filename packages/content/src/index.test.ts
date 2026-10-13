// FR-N/A, NFR-015, ADR-016: Test content package baseline.
import { describe, expect, it } from "vitest";
import { ABHYAS_CONTENT_VERSION, getContentInfo } from "./index";

describe("content package", () => {
  it("exports correct version", () => {
    expect(ABHYAS_CONTENT_VERSION).toBe("0.1.0");
  });

  it("reports correct info", () => {
    const info = getContentInfo();
    expect(info.name).toBe("@abhyas/content");
  });
});
