// Script to download locked Latin-subset woff2 fonts for Abhyas (ADR-020, NFR-025)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const FONTS_DIR = path.resolve("apps/web/public/fonts");
const STYLES_DIR = path.resolve("apps/web/src/styles");

fs.mkdirSync(FONTS_DIR, { recursive: true });
fs.mkdirSync(STYLES_DIR, { recursive: true });

const FONT_SPECS = [
  {
    family: "Pixelify Sans",
    weights: [500, 700],
    role: "display",
    fileNamePrefix: "pixelify-sans",
  },
  {
    family: "Instrument Sans",
    weights: [400, 500, 600],
    role: "body",
    fileNamePrefix: "instrument-sans",
  },
  {
    family: "JetBrains Mono",
    weights: [400, 500, 700],
    role: "mono",
    fileNamePrefix: "jetbrains-mono",
  },
  {
    family: "Caveat",
    weights: [600],
    role: "hand",
    fileNamePrefix: "caveat",
  },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchCssForFont(family, weight) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to fetch CSS for ${family} ${weight}: ${res.statusText}`);
  return res.text();
}

function extractLatinBlock(css) {
  const blocks = css.split("/*");
  for (const block of blocks) {
    if (block.trim().startsWith("latin */")) {
      const full = "/*" + block;
      const urlMatch = full.match(/src:\s*url\((https:\/\/[^)]+)\)/);
      const unicodeMatch = full.match(/unicode-range:\s*([^;]+);/);
      if (urlMatch) {
        return {
          url: urlMatch[1],
          unicodeRange: unicodeMatch ? unicodeMatch[1].trim() : undefined,
        };
      }
    }
  }
  // Fallback to first url found
  const urlMatch = css.match(/src:\s*url\((https:\/\/[^)]+)\)/);
  if (urlMatch) {
    return { url: urlMatch[1] };
  }
  throw new Error(`Could not extract woff2 url from CSS:\n${css}`);
}

async function run() {
  const generatedCssBlocks = [];
  const measurements = [];

  for (const spec of FONT_SPECS) {
    for (const weight of spec.weights) {
      console.log(`Processing ${spec.family} (weight: ${weight})...`);
      const css = await fetchCssForFont(spec.family, weight);
      const latin = extractLatinBlock(css);
      const fileName = `${spec.fileNamePrefix}-${weight}.woff2`;
      const filePath = path.join(FONTS_DIR, fileName);

      // Download woff2 file
      const fontRes = await fetch(latin.url);
      if (!fontRes.ok) throw new Error(`Failed to download ${latin.url}: ${fontRes.statusText}`);
      const arrayBuffer = await fontRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      const rawBytes = buffer.length;
      const gzippedBytes = zlib.gzipSync(buffer).length;
      measurements.push({
        family: spec.family,
        weight,
        fileName,
        rawBytes,
        gzippedBytes,
      });

      const rangeRule = latin.unicodeRange ? `\n  unicode-range: ${latin.unicodeRange};` : "";
      generatedCssBlocks.push(`/* ${spec.family} - weight ${weight} */
@font-face {
  font-family: '${spec.family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${fileName}') format('woff2');${rangeRule}
}
`);
    }
  }

  // Write fonts.css
  const fontsCssPath = path.join(STYLES_DIR, "fonts.css");
  fs.writeFileSync(fontsCssPath, generatedCssBlocks.join("\n"));
  console.log(`Wrote ${fontsCssPath}`);

  // Summary
  console.log("\n=== FONT PAYLOAD MEASUREMENT (NFR-025) ===");
  let totalRaw = 0;
  let totalGzip = 0;
  let _aboveFoldRaw = 0;
  let aboveFoldGzip = 0;

  for (const m of measurements) {
    totalRaw += m.rawBytes;
    totalGzip += m.gzippedBytes;
    // Above fold fonts: Pixelify 700 + Instrument Sans 400 & 600 + JetBrains Mono 700
    const isAboveFold =
      (m.family === "Pixelify Sans" && m.weight === 700) ||
      (m.family === "Instrument Sans" && (m.weight === 400 || m.weight === 600)) ||
      (m.family === "JetBrains Mono" && m.weight === 700);

    if (isAboveFold) {
      _aboveFoldRaw += m.rawBytes;
      aboveFoldGzip += m.gzippedBytes;
    }

    console.log(
      `- ${m.family} (${m.weight}): ${(m.rawBytes / 1024).toFixed(1)} KB (gzipped: ${(m.gzippedBytes / 1024).toFixed(1)} KB)`
    );
  }

  console.log(
    `\nTotal all weights: ${(totalRaw / 1024).toFixed(1)} KB (gzipped: ${(totalGzip / 1024).toFixed(1)} KB)`
  );
  console.log(
    `Above-the-fold target (< 150 KB gzipped): ${(aboveFoldGzip / 1024).toFixed(1)} KB gzipped. BUDGET MET: ${aboveFoldGzip / 1024 <= 150 ? "YES" : "NO"}`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
