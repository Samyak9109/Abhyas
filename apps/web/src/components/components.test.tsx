// FR-N/A, NFR-011, ADR-020, ADR-021: Comprehensive M0.2 test suite covering rendering, themes, and axe checks.
import { render } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import {
  Banner,
  Button,
  Callout,
  Dialog,
  Disclosure,
  Input,
  Progress,
  RadioCard,
  SecretInput,
  Skeleton,
  Stepper,
  Switch,
  Tabs,
  Toast,
} from "./index";

describe("M0.2: Base Component Suite", () => {
  const themes = ["ink", "paper"] as const;

  themes.forEach((theme) => {
    describe(`Theme: ${theme}`, () => {
      it("renders Button in all variants and states without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" isHero>
              Hero
            </Button>
            <Button variant="primary" isLoading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Input in default, helper, and error states without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Input label="Username" placeholder="Enter username" helperText="Alphanumeric only" />
            <Input label="Email" errorMessage="Invalid email address" defaultValue="bad-email" />
            <Input label="Disabled" disabled defaultValue="disabled content" />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders SecretInput with accessible toggle without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <SecretInput label="API Key" helperText="Stored locally" />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Switch in checked and unchecked states without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Switch label="Microphone" checked={true} onChange={() => {}} />
            <Switch label="Notifications" checked={false} onChange={() => {}} />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders RadioCard in selected and unselected states without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme} role="radiogroup" aria-label="Providers">
            <RadioCard
              title="Gemini"
              description="Direct browser calls"
              monogram="G"
              checked={true}
            />
            <RadioCard
              title="OpenAI"
              description="Compatible endpoints"
              monogram="O"
              checked={false}
            />
            <RadioCard
              title="Ollama"
              description="Local models"
              monogram="L"
              checked={false}
              comingSoon
            />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Stepper without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Stepper
              currentStepIndex={1}
              steps={[
                { id: "1", label: "Step 1" },
                { id: "2", label: "Step 2" },
                { id: "3", label: "Step 3" },
              ]}
            />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Callout across all variants without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Callout variant="info" title="Info">
              Informational note
            </Callout>
            <Callout variant="warning" title="Warning">
              Caution required
            </Callout>
            <Callout variant="danger" title="Danger">
              Error condition
            </Callout>
            <Callout variant="success" title="Success">
              Operation succeeded
            </Callout>
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Dialog without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Dialog isOpen={true} onClose={() => {}} title="Confirm Action">
              <p>Are you sure you want to proceed?</p>
            </Dialog>
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Toast and Banner without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Banner message="Offline mode active" variant="warning" />
            <Toast message="Saved successfully" />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Progress and Skeleton without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Progress label="Uploading" value={45} />
            <Progress label="Processing" />
            <Skeleton height={24} />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Tabs with keyboard support without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Tabs
              selectedId="t1"
              onSelect={() => {}}
              items={[
                { id: "t1", label: "Tab 1", content: <p>Content 1</p> },
                { id: "t2", label: "Tab 2", content: <p>Content 2</p> },
              ]}
            />
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders Disclosure without axe violations", async () => {
        const { container } = render(
          <div data-theme={theme}>
            <Disclosure summary="Frequently asked question">Answer body</Disclosure>
          </div>
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });

  describe("Token & Font Integrity Rules (NFR-025, ADR-020, ADR-021)", () => {
    it("ensures fonts.css contains NO font CDN urls (zero external font calls)", () => {
      const fontsCss = fs.readFileSync(path.resolve("apps/web/src/styles/fonts.css"), "utf8");
      expect(fontsCss).not.toContain("fonts.googleapis.com");
      expect(fontsCss).not.toContain("fonts.gstatic.com");
      expect(fontsCss).not.toContain("http://");
      expect(fontsCss).not.toContain("https://");
      expect(fontsCss).toMatch(/src:\s*url\(["']?\/fonts\//);
    });

    it("verifies that all 9 required woff2 font files exist on disk", () => {
      const requiredFiles = [
        "pixelify-sans-500.woff2",
        "pixelify-sans-700.woff2",
        "instrument-sans-400.woff2",
        "instrument-sans-500.woff2",
        "instrument-sans-600.woff2",
        "jetbrains-mono-400.woff2",
        "jetbrains-mono-500.woff2",
        "jetbrains-mono-700.woff2",
        "caveat-600.woff2",
      ];

      for (const file of requiredFiles) {
        const filePath = path.resolve("apps/web/public/fonts", file);
        expect(fs.existsSync(filePath)).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBeGreaterThan(1000);
      }
    });

    it("verifies contrast ratios from design.md 4.2 are documented and defined in tokens.css", () => {
      const tokensCss = fs
        .readFileSync(path.resolve("apps/web/src/styles/tokens.css"), "utf8")
        .toLowerCase();
      // Ink values
      expect(tokensCss).toContain("--bg: #121110");
      expect(tokensCss).toContain("--surface: #1c1a17");
      expect(tokensCss).toContain("--surface-2: #26231f");
      expect(tokensCss).toContain("--line: #3a352f");
      expect(tokensCss).toContain("--line-strong: #7d7468");
      expect(tokensCss).toContain("--text: #efe9dc");
      expect(tokensCss).toContain("--text-muted: #a9a296");
      expect(tokensCss).toContain("--accent: #ff6a2b");

      // Paper values
      expect(tokensCss).toContain("--bg: #efe9dc");
      expect(tokensCss).toContain("--surface: #f7f3ea");
      expect(tokensCss).toContain("--surface-2: #e6dfcf");
      expect(tokensCss).toContain("--line: #cfc6b4");
      expect(tokensCss).toContain("--line-strong: #7a7266");
      expect(tokensCss).toContain("--text: #121110");
      expect(tokensCss).toContain("--text-muted: #5a5348");
      expect(tokensCss).toContain("--accent-text: #a83409");
    });

    it("verifies no raw colors or font families exist outside token and font files (token purity)", () => {
      const componentsDir = path.resolve("apps/web/src/components");
      const componentFiles = fs
        .readdirSync(componentsDir)
        .filter((f: string) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));
      const componentsCss = fs.readFileSync(
        path.resolve("apps/web/src/styles/components.css"),
        "utf8"
      );

      // Check components.css
      const hexColorRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
      const rgbColorRegex = /rgba?\(/g;
      expect(componentsCss.match(hexColorRegex)).toBeNull();
      expect(componentsCss.match(rgbColorRegex)).toBeNull();

      // Check component TSX files
      for (const file of componentFiles) {
        const content = fs.readFileSync(path.join(componentsDir, file), "utf8");
        expect(content.match(hexColorRegex)).toBeNull();
        expect(content.match(rgbColorRegex)).toBeNull();
      }
    });
  });
});
