// FR-033, ADR-019, NFR-012: Prerender export for public static HTML generation.
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "./LandingPage";
import { PrivacyPage } from "./PrivacyPage";
import { OpenSourcePage } from "./OpenSourcePage";
import { KeyGuidePage } from "./KeyGuidePage";
import { TroubleshootingPage } from "./TroubleshootingPage";
import { LocalModelsGuidePage } from "./LocalModelsGuidePage";
import { RoadmapPage } from "./RoadmapPage";
import { NotFoundPage } from "./NotFoundPage";

export interface PageMetadata {
  route: string;
  title: string;
  description: string;
  html: string;
}

export const PUBLIC_ROUTES = [
  "/",
  "/privacy",
  "/open-source",
  "/guide/keys",
  "/guide/local-models",
  "/roadmap",
  "/help",
  "/404",
] as const;

export function renderPage(route: string): PageMetadata {
  switch (route) {
    case "/":
      return {
        route,
        title: "Abhyas — Private AI Interview Practice",
        description:
          "Private, realistic voice interview practice with honest scoring that stays on your device. Zero telemetry, no accounts, and 100% client-side.",
        html: renderToStaticMarkup(<LandingPage />),
      };
    case "/privacy":
      return {
        route,
        title: "Privacy & Egress Architecture — Abhyas",
        description:
          "Verifiable privacy guarantees, data classification inventory, and strict network allowlist for Abhyas.",
        html: renderToStaticMarkup(<PrivacyPage />),
      };
    case "/open-source":
      return {
        route,
        title: "Open Source & MIT License — Abhyas",
        description:
          "Abhyas is 100% open-source software licensed under MIT. Zero copyleft dependencies, verifiable code, and trademark guidelines.",
        html: renderToStaticMarkup(<OpenSourcePage />),
      };
    case "/guide/keys":
      return {
        route,
        title: "API Key Setup Guide — Abhyas",
        description:
          "Step-by-step illustrated guide for Google Gemini and OpenAI API keys with verified last-checked dates.",
        html: renderToStaticMarkup(<KeyGuidePage />),
      };
    case "/guide/local-models":
      return {
        route,
        title: "Local Models & Offline Guide — Abhyas",
        description:
          "Run interview practice 100% offline or with zero cloud egress using in-browser WebGPU models or local servers (Ollama, LM Studio) with CORS setup instructions.",
        html: renderToStaticMarkup(<LocalModelsGuidePage />),
      };
    case "/roadmap":
      return {
        route,
        title: "Roadmap & Release Notes — Abhyas",
        description:
          "Development phases in plain words, current verified status, and release notes. No dates promised.",
        html: renderToStaticMarkup(<RoadmapPage />),
      };
    case "/help":
      return {
        route,
        title: "Troubleshooting & Compatibility — Abhyas",
        description:
          "Browser compatibility matrix, common error diagnostics (quota, keys, microphone, storage), and redacted diagnostics instructions.",
        html: renderToStaticMarkup(<TroubleshootingPage />),
      };
    case "/404":
    default:
      return {
        route,
        title: "Page Not Found (404) — Abhyas",
        description: "The requested route does not exist or has been moved.",
        html: renderToStaticMarkup(<NotFoundPage mode="not-found" />),
      };
  }
}
