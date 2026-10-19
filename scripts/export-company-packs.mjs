#!/usr/bin/env node
// Architecture 15.3, FR-026: Nightly static mirror export for company packs.
// Exports validated packs and master index into static directory (e.g. apps/web/public/packs)
// so the web client continues functioning fully even if the API backend or budget cap disappears.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const defaultSrcDir = path.resolve(rootDir, "packages/content/packs");
const defaultOutDir = path.resolve(rootDir, "apps/web/public/packs");

function parseArgs() {
  const args = process.argv.slice(2);
  let srcDir = defaultSrcDir;
  let outDir = defaultOutDir;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--src" && args[i + 1]) {
      srcDir = path.resolve(process.cwd(), args[i + 1]);
      i++;
    } else if (args[i] === "--out" && args[i + 1]) {
      outDir = path.resolve(process.cwd(), args[i + 1]);
      i++;
    }
  }

  return { srcDir, outDir };
}

function exportStaticPacks() {
  const { srcDir, outDir } = parseArgs();

  if (!fs.existsSync(srcDir)) {
    console.error(`Source directory does not exist: ${srcDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(".json") && f !== "index.json");
  const indexItems = [];

  for (const file of files) {
    const filePath = path.join(srcDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const pack = JSON.parse(content);

    // Basic required pack validation
    if (!pack.slug || !pack.name || !pack.domain) {
      console.warn(`Skipping invalid pack format in ${file}`);
      continue;
    }

    // Write individual pack file to outDir
    const destPath = path.join(outDir, `${pack.slug}.json`);
    fs.writeFileSync(destPath, JSON.stringify(pack, null, 2), "utf8");

    indexItems.push({
      slug: pack.slug,
      name: pack.name,
      domain: pack.domain,
      aliases: pack.aliases || [],
      coverage: pack.coverage || "medium",
      status: "ready",
      retrievedAt: pack.retrievedAt,
      ttlDays: pack.ttlDays || 90,
    });
  }

  // Sort index items deterministically by name
  indexItems.sort((a, b) => a.name.localeCompare(b.name));

  const indexPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    companies: indexItems,
  };

  const indexPath = path.join(outDir, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(indexPayload, null, 2), "utf8");

  console.log(`✓ Exported ${indexItems.length} company packs to static mirror: ${outDir}`);
  console.log(`✓ Master index generated at: ${indexPath}`);
}

exportStaticPacks();
