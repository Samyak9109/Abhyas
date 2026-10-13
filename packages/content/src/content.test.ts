// FR-014, FR-017, ADR-006: Unit tests for content scaffolding, schemas, and validation engine.
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateTaxonomy,
  validateRubric,
  validateQuestionBank,
  REQUIRED_EXPERIENCE_LEVELS,
} from "./validator.js";
import { validateContentDirectory } from "./validate-directory.js";

const CONTENT_DIR = path.resolve(__dirname, "..");

describe("M0.4: Content Scaffolding & Validation Engine", () => {
  describe("Production Content Files", () => {
    it("validates the entire packages/content directory successfully", () => {
      const result = validateContentDirectory(CONTENT_DIR);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.summary.skillsCount).toBe(15);
      expect(result.summary.rubricsCount).toBe(5);
      expect(result.summary.questionsCount).toBeGreaterThanOrEqual(10);
    });

    it("verifies all 5 required experience levels exist with all 5 criteria", () => {
      expect(REQUIRED_EXPERIENCE_LEVELS).toEqual([
        "intern_fresher",
        "junior",
        "mid",
        "senior",
        "staff_plus",
      ]);

      for (const level of REQUIRED_EXPERIENCE_LEVELS) {
        const rubricPath = path.join(CONTENT_DIR, "rubrics", `${level}.json`);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const raw = require(rubricPath);
        const rubric = validateRubric(raw);

        expect(rubric.level).toBe(level);
        expect(rubric.axes.depth.length).toBeGreaterThan(10);
        expect(rubric.axes.ambiguity.length).toBeGreaterThan(10);
        expect(rubric.axes.expectedScope.length).toBeGreaterThan(10);
        expect(rubric.axes.followUpPressure.length).toBeGreaterThan(10);
        expect(rubric.axes.behavioralExpectations.length).toBeGreaterThan(10);

        const criteriaKeys = ["relevance", "structure", "depth", "clarity", "levelFit"] as const;
        for (const key of criteriaKeys) {
          const crit = rubric.criteria[key];
          expect(crit.name.length).toBeGreaterThan(0);
          expect(crit.description.length).toBeGreaterThan(10);
          expect(crit.anchors["1"].length).toBeGreaterThan(10);
          expect(crit.anchors["3"].length).toBeGreaterThan(10);
          expect(crit.anchors["5"].length).toBeGreaterThan(10);
        }
      }
    });

    it("verifies all sample bank questions reference taxonomy skill tags", () => {
      const taxonomyPath = path.join(CONTENT_DIR, "taxonomy", "skills.json");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const taxonomyRaw = require(taxonomyPath);
      const taxonomy = validateTaxonomy(taxonomyRaw);
      const skillIds = new Set(taxonomy.skills.map((s) => s.id));

      const questionsPath = path.join(CONTENT_DIR, "questions", "sample-bank.json");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const questionsRaw = require(questionsPath);
      const questions = validateQuestionBank(questionsRaw, skillIds);

      expect(questions.length).toBeGreaterThanOrEqual(10);
      for (const q of questions) {
        expect(q.skillTags.length).toBeGreaterThan(0);
        for (const tag of q.skillTags) {
          expect(skillIds.has(tag)).toBe(true);
        }
        expect(q.difficulty).toBeGreaterThanOrEqual(1);
        expect(q.difficulty).toBeLessThanOrEqual(5);
        expect(q.source.length).toBeGreaterThan(0);
        expect(q.license.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Rejection of Invalid Content", () => {
    it("fails when a question contains an unverified skill tag not in the taxonomy (FR-014)", () => {
      const validSkillIds = new Set(["dsa", "communication"]);
      const invalidQuestions = [
        {
          id: "q-test-001",
          text: "What is the time complexity of quicksort?",
          type: "dsa_verbal",
          skillTags: ["dsa", "quantum_computing_unknown_tag"],
          level: "intern_fresher",
          difficulty: 1,
          followUps: [],
          rubricHints: [],
          source: "Test",
          license: "MIT",
        },
      ];

      expect(() => validateQuestionBank(invalidQuestions, validSkillIds)).toThrowError(
        /contains unknown skill tag "quantum_computing_unknown_tag"/
      );
    });

    it("fails when difficulty is out of range 1-5 (FR-007, FR-017)", () => {
      const invalidQuestions = [
        {
          id: "q-test-002",
          text: "Explain distributed consensus protocols in high throughput systems.",
          type: "system_design",
          skillTags: ["system_design"],
          level: "senior",
          difficulty: 6, // Invalid > 5
          followUps: [],
          rubricHints: [],
          source: "Test",
          license: "MIT",
        },
      ];

      expect(() => validateQuestionBank(invalidQuestions)).toThrowError(
        /Question bank validation failed/
      );
    });

    it("fails when question IDs are duplicated", () => {
      const duplicateQuestions = [
        {
          id: "q-duplicate",
          text: "First question text for testing duplicate IDs.",
          type: "behavioral",
          skillTags: ["ownership"],
          level: "junior",
          difficulty: 2,
          followUps: [],
          rubricHints: [],
          source: "Test",
          license: "MIT",
        },
        {
          id: "q-duplicate",
          text: "Second question text with identical ID.",
          type: "behavioral",
          skillTags: ["ownership"],
          level: "junior",
          difficulty: 2,
          followUps: [],
          rubricHints: [],
          source: "Test",
          license: "MIT",
        },
      ];

      expect(() => validateQuestionBank(duplicateQuestions)).toThrowError(
        /Question bank records must have unique IDs/
      );
    });

    it("fails when a rubric anchor is missing", () => {
      const invalidRubric = {
        level: "junior",
        description: "Junior engineer rubric missing an anchor",
        axes: {
          depth: "Some depth description",
          ambiguity: "Some ambiguity description",
          expectedScope: "Some scope description",
          followUpPressure: "Some pressure description",
          behavioralExpectations: "Some behavioral expectations",
        },
        criteria: {
          relevance: {
            name: "Relevance",
            description: "Relevance description",
            anchors: {
              "1": "Anchor 1 description",
              // Missing "3"
              "5": "Anchor 5 description",
            },
          },
          structure: {
            name: "Structure",
            description: "Structure description",
            anchors: { "1": "1...", "3": "3...", "5": "5..." },
          },
          depth: {
            name: "Depth",
            description: "Depth description",
            anchors: { "1": "1...", "3": "3...", "5": "5..." },
          },
          clarity: {
            name: "Clarity",
            description: "Clarity description",
            anchors: { "1": "1...", "3": "3...", "5": "5..." },
          },
          levelFit: {
            name: "Level Fit",
            description: "Level Fit description",
            anchors: { "1": "1...", "3": "3...", "5": "5..." },
          },
        },
      };

      expect(() => validateRubric(invalidRubric)).toThrowError(/Rubric validation failed/);
    });

    it("fails when taxonomy contains duplicate skill IDs", () => {
      const invalidTaxonomy = {
        version: 1,
        skills: [
          {
            id: "dsa",
            name: "Data Structures & Algorithms",
            category: "technical",
            description: "Algorithmic problem solving and complexity.",
          },
          {
            id: "dsa", // duplicate
            name: "Duplicate DSA entry",
            category: "technical",
            description: "Duplicate skill definition for testing.",
          },
        ],
      };

      expect(() => validateTaxonomy(invalidTaxonomy)).toThrowError(
        /Taxonomy skills must have unique IDs/
      );
    });
  });
});
