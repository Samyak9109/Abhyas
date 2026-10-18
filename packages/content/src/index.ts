// FR-N/A, NFR-015, ADR-016: Content and data scaffolding for Abhyas.

export const ABHYAS_CONTENT_VERSION = "0.1.0";

/**
 * Health check verification for content package.
 */
export function getContentInfo(): { name: string; version: string } {
  return {
    name: "@abhyas/content",
    version: ABHYAS_CONTENT_VERSION,
  };
}

export * from "./validator.js";
export * from "./sample-bank.js";
export * from "./rubrics.js";
export * from "./skills.js";
export * from "./models.js";
