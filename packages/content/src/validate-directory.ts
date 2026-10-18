// FR-014, FR-017, FR-025, ADR-006, ADR-008: Node filesystem-based directory validation for content package.
import fs from "node:fs";
import path from "node:path";
import {
  validateTaxonomy,
  validateRubric,
  validateQuestionBank,
  validateCuratedModelsCatalog,
  validateCompanyPack,
  REQUIRED_EXPERIENCE_LEVELS,
  type ValidationResult,
} from "./validator.js";

/**
 * Validates the entire content directory: taxonomy, rubrics for all 5 levels, question banks, curated models, and company packs.
 */
export function validateContentDirectory(contentDir: string): ValidationResult {
  const errors: string[] = [];
  let skillsCount = 0;
  let rubricsCount = 0;
  let questionsCount = 0;
  let modelsCount = 0;
  let packsCount = 0;

  // 1. Validate Taxonomy
  const taxonomyPath = path.join(contentDir, "taxonomy", "skills.json");
  const validSkillIds = new Set<string>();

  if (!fs.existsSync(taxonomyPath)) {
    errors.push(`Taxonomy file missing at expected path: ${taxonomyPath}`);
  } else {
    try {
      const taxonomyRaw = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
      const taxonomy = validateTaxonomy(taxonomyRaw);
      for (const skill of taxonomy.skills) {
        validSkillIds.add(skill.id);
      }
      skillsCount = taxonomy.skills.length;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // 2. Validate Rubrics for all 5 Experience Levels
  const rubricsDir = path.join(contentDir, "rubrics");
  if (!fs.existsSync(rubricsDir)) {
    errors.push(`Rubrics directory missing at expected path: ${rubricsDir}`);
  } else {
    for (const level of REQUIRED_EXPERIENCE_LEVELS) {
      const rubricPath = path.join(rubricsDir, `${level}.json`);
      if (!fs.existsSync(rubricPath)) {
        errors.push(`Missing required rubric anchor file for level "${level}": ${rubricPath}`);
        continue;
      }
      try {
        const rubricRaw = JSON.parse(fs.readFileSync(rubricPath, "utf8"));
        const parsed = validateRubric(rubricRaw);
        if (parsed.level !== level) {
          errors.push(
            `Rubric file "${level}.json" has mismatched internal level field "${parsed.level}"`
          );
        } else {
          rubricsCount++;
        }
      } catch (err) {
        errors.push(`Rubric "${level}.json": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // 3. Validate Question Banks
  const questionsDir = path.join(contentDir, "questions");
  const seenQuestionIds = new Set<string>();

  if (!fs.existsSync(questionsDir)) {
    errors.push(`Questions directory missing at expected path: ${questionsDir}`);
  } else {
    const questionFiles = fs.readdirSync(questionsDir).filter((f) => f.endsWith(".json"));
    if (questionFiles.length === 0) {
      errors.push(`No question bank files found in ${questionsDir}`);
    } else {
      for (const file of questionFiles) {
        const filePath = path.join(questionsDir, file);
        try {
          const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const questions = validateQuestionBank(
            raw,
            validSkillIds.size > 0 ? validSkillIds : undefined
          );
          for (const q of questions) {
            if (seenQuestionIds.has(q.id)) {
              errors.push(
                `Duplicate question ID "${q.id}" detected across question banks in ${file}`
              );
            }
            seenQuestionIds.add(q.id);
          }
          questionsCount += questions.length;
        } catch (err) {
          errors.push(
            `Question bank "${file}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }
  }

  // 4. Validate Curated Models Catalog (phases.md M3.3, FR-023)
  const modelsPath = path.join(contentDir, "models.json");
  if (!fs.existsSync(modelsPath)) {
    errors.push(`Curated models catalog missing at expected path: ${modelsPath}`);
  } else {
    try {
      const modelsRaw = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
      const catalog = validateCuratedModelsCatalog(modelsRaw);
      modelsCount = catalog.models.length;
    } catch (err) {
      errors.push(`Curated models catalog: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 5. Validate Company Packs (phases.md M4.1, FR-025, ADR-008)
  const packsDir = path.join(contentDir, "packs");
  const seenPackSlugs = new Set<string>();

  if (fs.existsSync(packsDir)) {
    const packFiles = fs.readdirSync(packsDir).filter((f) => f.endsWith(".json"));
    for (const file of packFiles) {
      const filePath = path.join(packsDir, file);
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const pack = validateCompanyPack(raw);

        // Ensure file name matches slug (e.g. stripe.json -> slug: 'stripe')
        const expectedSlug = path.basename(file, ".json");
        if (pack.slug !== expectedSlug) {
          errors.push(
            `Company pack file "${file}" has mismatched internal slug "${pack.slug}" (expected "${expectedSlug}")`
          );
        }

        if (seenPackSlugs.has(pack.slug)) {
          errors.push(`Duplicate company pack slug "${pack.slug}" in "${file}"`);
        }
        seenPackSlugs.add(pack.slug);

        packsCount++;
      } catch (err) {
        errors.push(`Company pack "${file}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    summary: {
      skillsCount,
      rubricsCount,
      questionsCount,
      modelsCount,
      packsCount,
    },
    errors,
  };
}
