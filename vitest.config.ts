// FR-N/A, NFR-015, NFR-023: Monorepo test runner configuration.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: [
      "packages/*/src/**/*.{test,spec}.ts",
      "apps/*/src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.ts",
    ],
  },
});
