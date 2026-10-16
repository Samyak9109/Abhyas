// FR-033, NFR-012, ADR-019: Prerendered artifacts and network allowlist test for public pages.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("M1.9: Prerendered Static Site & Network Verification", () => {
  const distPath = path.resolve(__dirname, "../apps/web/dist");

  it("verifies static HTML files exist for all public pages", () => {
    const expectedFiles = [
      "index.html",
      "privacy/index.html",
      "open-source/index.html",
      "guide/keys/index.html",
      "help/index.html",
      "404.html",
      "sitemap.xml",
      "robots.txt",
    ];

    for (const file of expectedFiles) {
      const fullPath = path.resolve(distPath, file);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content.length).toBeGreaterThan(20);
    }
  });

  it("verifies sitemap.xml contains all public route URLs and excludes app routes", () => {
    const sitemapPath = path.resolve(distPath, "sitemap.xml");
    const sitemap = fs.readFileSync(sitemapPath, "utf-8");

    expect(sitemap).toContain("<loc>https://abhyas.app/</loc>");
    expect(sitemap).toContain("<loc>https://abhyas.app/privacy</loc>");
    expect(sitemap).toContain("<loc>https://abhyas.app/open-source</loc>");
    expect(sitemap).toContain("<loc>https://abhyas.app/guide/keys</loc>");
    expect(sitemap).toContain("<loc>https://abhyas.app/help</loc>");
    expect(sitemap).not.toContain("/app/");
  });

  it("verifies static HTML files contain zero third-party script or font CDN references", () => {
    const publicHtmlFiles = [
      "index.html",
      "privacy/index.html",
      "open-source/index.html",
      "guide/keys/index.html",
      "help/index.html",
      "404.html",
    ];

    const disallowedKeywords = [
      "fonts.googleapis.com",
      "fonts.gstatic.com",
      "google-analytics.com",
      "googletagmanager.com",
      "segment.io",
      "mixpanel.com",
      "sentry.io",
    ];

    for (const file of publicHtmlFiles) {
      const fullPath = path.resolve(distPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");

      for (const disallowed of disallowedKeywords) {
        expect(content).not.toContain(disallowed);
      }

      // Check self-hosted fonts preload presence
      expect(content).toContain('href="/fonts/pixelify-sans-700.woff2"');
      expect(content).toContain('href="/fonts/instrument-sans-400.woff2"');
    }
  });
});
