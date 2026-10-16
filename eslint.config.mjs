// FR-N/A, NFR-015, ADR-016: Strict linting and package boundary enforcement.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      ".planning/**",
      "Assets/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Boundary rules: packages/core MUST be framework-free (no React, no DOM, no apps/content imports)
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "packages/core must not import React (ADR-016 framework-free core).",
            },
            {
              name: "react-dom",
              message: "packages/core must not import react-dom (ADR-016 framework-free core).",
            },
            {
              name: "react-dom/client",
              message: "packages/core must not import react-dom (ADR-016 framework-free core).",
            },
          ],
          patterns: [
            {
              group: ["apps/*", "**/apps/**", "@abhyas/web", "@abhyas/web/*"],
              message: "packages/core cannot import from apps (ADR-016 architecture boundary).",
            },
            {
              group: ["@abhyas/content", "@abhyas/content/*"],
              message: "packages/core cannot import from content package (ADR-016).",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message: "No DOM window in packages/core (ADR-016 framework-free core).",
        },
        {
          name: "document",
          message: "No DOM document in packages/core (ADR-016 framework-free core).",
        },
        {
          name: "navigator",
          message: "No DOM navigator in packages/core (ADR-016 framework-free core).",
        },
        {
          name: "localStorage",
          message: "No localStorage in packages/core; use Storage interface (ADR-016).",
        },
        {
          name: "sessionStorage",
          message: "No sessionStorage in packages/core; use Storage interface (ADR-016).",
        },
      ],
    },
  },
  // Boundary rules: packages/content cannot import from apps
  {
    files: ["packages/content/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["apps/*", "**/apps/**", "@abhyas/web", "@abhyas/web/*"],
              message: "packages/content cannot import from apps (ADR-016 architecture boundary).",
            },
          ],
        },
      ],
    },
  },
  // apps/web rules
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  // Static browser assets served as-is (pre-paint theme bootstrap)
  {
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  // scripts rules
  {
    files: ["scripts/**/*.{js,mjs}", "apps/web/scripts/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  }
);
