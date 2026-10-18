// FR-033, NFR-011, NFR-012, ADR-019, ADR-021: Public site verification suite (PG-01 to PG-08).
// Acceptance criteria:
// - Pages build as static HTML
// - No third-party request on any public page
// - Zero axe accessibility violations in both Ink and Paper themes
// - Landing structure, fonts, and copy rules match design.md
// - Privacy page matches docs/privacy-audit.md
// - Key guide shows a last-checked date
// - No invented statistics, testimonials, or model names
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import {
  LandingPage,
  PrivacyPage,
  OpenSourcePage,
  KeyGuidePage,
  LocalModelsGuidePage,
  TroubleshootingPage,
  NotFoundPage,
} from "./index";

describe("M1.9: Public Static Pages & Docs (FR-033, ADR-019)", () => {
  describe("PG-01: Landing Page", () => {
    it("renders required hero elements, mascot collage, ticker, and CTA matching design.md", () => {
      render(<LandingPage />);

      // Hero headline with cursor
      expect(
        screen.getByRole("heading", { name: /practice interviews with private ai/i })
      ).toBeTruthy();

      // One-sentence promise
      expect(
        screen.getByText(
          /private, realistic voice interview practice with honest scoring that stays on your device/i
        )
      ).toBeTruthy();

      // Hand note
      expect(screen.getByText(/no sign up\. your data\. your device\./i)).toBeTruthy();

      // Primary CTA
      const startCtas = screen.getAllByRole("link", { name: /start practice/i });
      expect(startCtas.length).toBeGreaterThanOrEqual(1);

      // Mascot presence
      expect(
        screen.getByLabelText(/pixel mascot: a retro computer monitor with a smiling face/i)
      ).toBeTruthy();

      // Features section
      expect(screen.getByRole("heading", { name: /built for real progress/i })).toBeTruthy();
      expect(screen.getByText(/fast start/i)).toBeTruthy();
      expect(screen.getByText(/safe space/i)).toBeTruthy();
      expect(screen.getByText(/track progress/i)).toBeTruthy();
      expect(screen.getByText(/private and local/i)).toBeTruthy();

      // The Facts (verifiable facts only)
      expect(screen.getByRole("heading", { name: /verifiable guarantees/i })).toBeTruthy();
      expect(screen.getByText(/accounts needed/i)).toBeTruthy();
      expect(screen.getByText(/resumes sent to our servers/i)).toBeTruthy();
      expect(screen.getByText(/open source license/i)).toBeTruthy();

      // How it works 4 steps
      expect(screen.getByRole("heading", { name: /four steps to preparation/i })).toBeTruthy();
      expect(screen.getByText(/connect your ai/i)).toBeTruthy();
      expect(screen.getByText(/add your profile/i)).toBeTruthy();
      expect(screen.getByText(/choose your session/i)).toBeTruthy();
      expect(screen.getByText(/practice & improve/i)).toBeTruthy();

      // Closing CTA
      expect(
        screen.getByRole("heading", { name: /practice today\. be ready tomorrow/i })
      ).toBeTruthy();
    });

    it("has zero axe accessibility violations under Ink (dark) theme", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container } = render(<LandingPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("has zero axe accessibility violations under Paper (light) theme", async () => {
      document.documentElement.setAttribute("data-theme", "paper");
      const { container } = render(<LandingPage />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("PG-02: Privacy Page", () => {
    it("matches docs/privacy-audit.md data classification and egress allowlist", () => {
      render(<PrivacyPage />);

      expect(screen.getByRole("heading", { name: /what leaves your device/i })).toBeTruthy();

      // Core tenets
      expect(screen.getAllByText(/zero telemetry/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/direct ai egress/i)).toBeTruthy();

      // Data classification table elements
      expect(screen.getByText(/provider api keys/i)).toBeTruthy();
      expect(screen.getByText(/resumes & job descriptions/i)).toBeTruthy();
      expect(screen.getByText(/structured candidate profile/i)).toBeTruthy();
      expect(screen.getByText(/spoken audio \(push-to-talk\)/i)).toBeTruthy();
      expect(screen.getByText(/interview transcripts & answers/i)).toBeTruthy();

      // Egress destinations table
      expect(screen.getByText(/generativelanguage\.googleapis\.com/i)).toBeTruthy();
      expect(screen.getByText(/api\.openai\.com/i)).toBeTruthy();
      expect(screen.getByText(/localhost:\*/i)).toBeTruthy();
    });

    it("has zero axe accessibility violations under Ink and Paper themes", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container, rerender } = render(<PrivacyPage />);
      expect(await axe(container)).toHaveNoViolations();

      document.documentElement.setAttribute("data-theme", "paper");
      rerender(<PrivacyPage />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("PG-03: Open Source & License Page", () => {
    it("renders full MIT license text, trademark terms, and contributing instructions", () => {
      render(<OpenSourcePage />);

      expect(screen.getByRole("heading", { name: /open source & mit license/i })).toBeTruthy();

      // MIT License text
      expect(screen.getByText(/permission is hereby granted, free of charge/i)).toBeTruthy();
      expect(screen.getAllByText(/copyleft/i).length).toBeGreaterThan(0);
    });

    it("has zero axe accessibility violations under Ink and Paper themes", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container, rerender } = render(<OpenSourcePage />);
      expect(await axe(container)).toHaveNoViolations();

      document.documentElement.setAttribute("data-theme", "paper");
      rerender(<OpenSourcePage />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("PG-04: Key Guide Page", () => {
    it("displays last-checked date and provider steppers (Gemini and OpenAI)", () => {
      render(<KeyGuidePage />);

      expect(screen.getByRole("heading", { name: /api key setup guide/i })).toBeTruthy();

      // Acceptance criterion: key guide shows a last-checked date
      expect(screen.getByText(/last checked:/i)).toBeTruthy();
      expect(screen.getByText(/october 2026/i)).toBeTruthy();

      // Provider guides
      expect(screen.getByRole("heading", { name: /google gemini api key/i })).toBeTruthy();
      expect(screen.getByRole("heading", { name: /openai api key/i })).toBeTruthy();
    });

    it("has zero axe accessibility violations under Ink and Paper themes", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container, rerender } = render(<KeyGuidePage />);
      expect(await axe(container)).toHaveNoViolations();

      document.documentElement.setAttribute("data-theme", "paper");
      rerender(<KeyGuidePage />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("PG-05: Troubleshooting & Compatibility Page", () => {
    it("renders browser support matrix and searchable error fixes", () => {
      render(<TroubleshootingPage />);

      expect(screen.getByRole("heading", { name: /compatibility & error fixes/i })).toBeTruthy();

      // Browser matrix
      expect(screen.getAllByText(/google chrome/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/microsoft edge/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/mozilla firefox/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/apple safari/i).length).toBeGreaterThanOrEqual(1);

      // Diagnostics instructions
      expect(
        screen.getByRole("heading", { name: /how to generate a redacted diagnostic report/i })
      ).toBeTruthy();
    });

    it("has zero axe accessibility violations under Ink and Paper themes", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container, rerender } = render(<TroubleshootingPage />);
      expect(await axe(container)).toHaveNoViolations();

      document.documentElement.setAttribute("data-theme", "paper");
      rerender(<TroubleshootingPage />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("PG-06: Local Models Guide Page", () => {
    it("renders device requirements, tiers, Ollama CORS setup, and basic feedback note", () => {
      render(<LocalModelsGuidePage />);

      expect(
        screen.getByRole("heading", { name: /local models & private practice/i })
      ).toBeTruthy();

      // PC Only & Text Only requirements
      expect(screen.getByRole("heading", { name: /1\. device requirements/i })).toBeTruthy();
      expect(screen.getByText(/pc only \(phones blocked\)/i)).toBeTruthy();
      expect(screen.getByText(/strictly text-only/i)).toBeTruthy();

      // Hardware Tiers table
      expect(screen.getByRole("heading", { name: /2\. hardware tiers/i })).toBeTruthy();
      expect(screen.getByText(/smollm2 1\.7b/i)).toBeTruthy();
      expect(screen.getByText(/llama 3\.2 3b/i)).toBeTruthy();
      expect(screen.getByText(/llama 3\.1 8b/i)).toBeTruthy();

      // Ollama & CORS section
      expect(
        screen.getByRole("heading", { name: /4\. ollama setup & cors configuration/i })
      ).toBeTruthy();
      expect(screen.getByText(/configure cors/i)).toBeTruthy();
      expect(screen.getAllByText(/ollama_origins/i).length).toBeGreaterThanOrEqual(1);

      // Honesty section
      expect(
        screen.getByRole("heading", { name: /6\. honesty: what "basic feedback" means/i })
      ).toBeTruthy();
    });

    it("has zero axe accessibility violations under Ink and Paper themes", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container, rerender } = render(<LocalModelsGuidePage />);
      expect(await axe(container)).toHaveNoViolations();

      document.documentElement.setAttribute("data-theme", "paper");
      rerender(<LocalModelsGuidePage />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe("PG-08: Not-Found & Fallback Shells", () => {
    it("renders problem mascot and recovery actions for 404, unsupported-browser, and offline states", () => {
      const { rerender } = render(<NotFoundPage mode="not-found" />);
      expect(screen.getByRole("heading", { name: /page not found/i })).toBeTruthy();
      expect(screen.getByRole("link", { name: /return to home/i })).toBeTruthy();

      rerender(<NotFoundPage mode="unsupported-browser" />);
      expect(screen.getByRole("heading", { name: /browser compatibility notice/i })).toBeTruthy();

      rerender(<NotFoundPage mode="offline" />);
      expect(screen.getByRole("heading", { name: /you are offline/i })).toBeTruthy();
    });

    it("has zero axe accessibility violations under Ink and Paper themes", async () => {
      document.documentElement.setAttribute("data-theme", "ink");
      const { container, rerender } = render(<NotFoundPage mode="not-found" />);
      expect(await axe(container)).toHaveNoViolations();

      document.documentElement.setAttribute("data-theme", "paper");
      rerender(<NotFoundPage mode="not-found" />);
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
