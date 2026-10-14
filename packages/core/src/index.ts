// FR-N/A, NFR-015, ADR-016: Pure domain logic core for Abhyas without DOM or React dependencies.

export const ABHYAS_CORE_VERSION = "0.1.0";

/**
 * Health check verification for framework-free core package.
 */
export function getCoreInfo(): { name: string; version: string; isFrameworkFree: boolean } {
  return {
    name: "@abhyas/core",
    version: ABHYAS_CORE_VERSION,
    isFrameworkFree: true,
  };
}

export * from "./providers/types";
export * from "./providers/mock-adapter";
export * from "./schemas";
export * from "./storage";
export * from "./settings";
export * from "./network";
