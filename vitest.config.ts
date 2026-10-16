import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@abhyas/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@abhyas/content": path.resolve(__dirname, "packages/content/src/index.ts"),
    },
  },
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
