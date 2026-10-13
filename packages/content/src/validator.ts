// FR-014, FR-017, ADR-006: Content validation engine for taxonomy, rubrics, and question bank.
import fs from "node:fs";
import path from "node:path";
import {
  TaxonomySchema,
  RubricLevelSchema,
  QuestionBankSchema,
  ExperienceLevelSchema,
  type Taxonomy,
  type RubricLevel,
  type QuestionBank,
  type ExperienceLevel,
} from "@abhyas/core";

export interface ValidationResult {
  valid: boolean;
  summary: {
    skillsCount: number;
    rubricsCount: number;
    questionsCount: number;
  };
  errors: string[];
}

/**
 * Validates a skill taxonomy object against TaxonomySchema.
 */
export function validateTaxonomy(data: unknown): Taxonomy {
  const result = TaxonomySchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Taxonomy validation failed: ${issues}`);
  }
  return result.data;
}

/**
 * Validates a level rubric object against RubricLevelSchema.
 */
export function validateRubric(data: unknown): RubricLevel {
  const result = RubricLevelSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Rubric validation failed: ${issues}`);
  }
  return result.data;
}

/**
 * Validates a question bank array against QuestionBankSchema and optional taxonomy skill IDs.
 */
export function validateQuestionBank(data: unknown, validSkillIds?: Set<string>): QuestionBank {
  const result = QuestionBankSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Question bank validation failed: ${issues}`);
  }

  // Cross-reference skillTags with taxonomy if validSkillIds are provided
  if (validSkillIds) {
    const errors: string[] = [];
    for (const q of result.data) {
      for (const tag of q.skillTags) {
        if (!validSkillIds.has(tag)) {
          errors.push(
            `Question "${q.id}" contains unknown skill tag "${tag}" not in taxonomy (FR-014)`
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new Error(`Question bank taxonomy verification failed: ${errors.join("; ")}`);
    }
  }

  return result.data;
}

const REQUIRED_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  "intern_fresher",
  "junior",
  "mid",
  "senior",
  "staff_plus",
];

/**
 * Validates the entire content directory: taxonomy, rubrics for all 5 levels, and question banks.
 */
export function validateContentDirectory(contentDir: string): ValidationResult {
  const errors: string[] = [];
  let skillsCount = 0;
  let rubricsCount = 0;
  let questionsCount = 0;

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

  return {
    valid: errors.length === 0,
    summary: {
      skillsCount,
      rubricsCount,
      questionsCount,
    },
    errors,
  };
}

export { REQUIRED_EXPERIENCE_LEVELS, ExperienceLevelSchema };
