// FR-002, FR-003: Tests for SHA-256 document and input hashing.
import { describe, expect, it } from "vitest";
import { computeSha256, hashProfileInputs } from "./hashing";

describe("Profile and Document Hashing (FR-002, FR-003)", () => {
  it("computes a deterministic 64-character hex SHA-256 hash", async () => {
    const text = "Sample resume content with technical skills: React, TypeScript, Node.js";
    const hash1 = await computeSha256(text);
    const hash2 = await computeSha256(text);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces identical composite hashes for identical profile inputs", async () => {
    const h1 = await hashProfileInputs(
      "Resume text here",
      "Job description here",
      "Frontend Engineer",
      "mid"
    );
    const h2 = await hashProfileInputs(
      "  Resume text here  ",
      "Job description here",
      "frontend engineer",
      "MID"
    );

    expect(h1).toBe(h2);
  });

  it("changes hash when any input parameter changes", async () => {
    const base = await hashProfileInputs("Resume A", "JD A", "Role A", "junior");
    const diffResume = await hashProfileInputs("Resume B", "JD A", "Role A", "junior");
    const diffJd = await hashProfileInputs("Resume A", "JD B", "Role A", "junior");
    const diffRole = await hashProfileInputs("Resume A", "JD A", "Role B", "junior");
    const diffLevel = await hashProfileInputs("Resume A", "JD A", "Role A", "senior");

    expect(base).not.toBe(diffResume);
    expect(base).not.toBe(diffJd);
    expect(base).not.toBe(diffRole);
    expect(base).not.toBe(diffLevel);
  });
});
