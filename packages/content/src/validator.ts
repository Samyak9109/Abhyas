import {
  TaxonomySchema,
  RubricLevelSchema,
  QuestionBankSchema,
  ExperienceLevelSchema,
  CuratedCatalogSchema,
  type Taxonomy,
  type RubricLevel,
  type QuestionBank,
  type ExperienceLevel,
  type CuratedCatalog,
} from "@abhyas/core";

export interface ValidationResult {
  valid: boolean;
  summary: {
    skillsCount: number;
    rubricsCount: number;
    questionsCount: number;
    modelsCount?: number;
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

/**
 * Validates a curated models catalog object against CuratedCatalogSchema (phases.md M3.3, FR-023).
 * Verifies version, 3 to 5 model count, measured speeds, and reference sanity test results.
 */
export function validateCuratedModelsCatalog(data: unknown): CuratedCatalog {
  const result = CuratedCatalogSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Curated models catalog validation failed: ${issues}`);
  }

  // Acceptance criteria check: Each listed model passes the sanity test on at least one reference device
  const errors: string[] = [];
  for (const model of result.data.models) {
    const sanity = model.sanityResult;
    if (sanity.status === "not-suitable") {
      errors.push(
        `Model "${model.id}" is marked "not-suitable"; each curated model must pass sanity test on at least one reference device (phases.md M3.3)`
      );
    }
    if (!sanity.speedPassed || !sanity.jsonValid || !sanity.instructionFollowing) {
      errors.push(
        `Model "${model.id}" sanity test failed (speedPassed: ${sanity.speedPassed}, jsonValid: ${sanity.jsonValid}, instructionFollowing: ${sanity.instructionFollowing})`
      );
    }
    if (!sanity.referenceDevice || sanity.referenceDevice.trim().length === 0) {
      errors.push(`Model "${model.id}" lacks reference device documentation in sanity result`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Curated models sanity verification failed: ${errors.join("; ")}`);
  }

  return result.data;
}

export const REQUIRED_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  "intern_fresher",
  "junior",
  "mid",
  "senior",
  "staff_plus",
];

export { ExperienceLevelSchema };
