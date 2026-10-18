// FR-014, FR-017, FR-025, ADR-006, ADR-008: CLI runner for CI content validation.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContentDirectory } from "./validate-directory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contentDir = path.resolve(__dirname, "..");

const result = validateContentDirectory(contentDir);

if (!result.valid) {
  console.error("Content validation failed with errors:");
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  // eslint-disable-next-line no-console
  console.log("Content validation succeeded:");
  // eslint-disable-next-line no-console
  console.log(`  - Skills in taxonomy: ${result.summary.skillsCount}`);
  // eslint-disable-next-line no-console
  console.log(`  - Level rubrics: ${result.summary.rubricsCount} (all 5 levels verified)`);
  // eslint-disable-next-line no-console
  console.log(`  - Validated questions: ${result.summary.questionsCount}`);
  // eslint-disable-next-line no-console
  console.log(
    `  - Curated models: ${result.summary.modelsCount} (measured speeds & sanity verified)`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - Company packs: ${result.summary.packsCount ?? 0} (evidenced claims & dates verified)`
  );
  process.exit(0);
}
