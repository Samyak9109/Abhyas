// FR-003, AI-001, AI-011: Structured profile extractor service.
// Coordinates input hashing, cache retrieval, AI extraction with schema validation,
// deterministic fallback, and token-bounded condensation.
import type { ChatMessage, ProviderAdapter } from "../providers/types";
import type { StructuredProfile } from "../schemas/profile.schema";
import type { StructuredProfileRow } from "../schemas/storage-rows.schema";
import type { StorageAdapter } from "../storage/storage-interface";
import { condenseProfile } from "./condenser";
import { extractFallbackProfile } from "./fallback-extractor";
import { hashProfileInputs } from "./hashing";
import {
  buildProfileExtractionPrompt,
  ProfileExtractionOutputSchema,
  type ProfileExtractionOutput,
  PROMPT_VERSION,
} from "./profile-prompt";

export interface ExtractProfileOptions {
  resumeText: string;
  jdText?: string;
  targetRole: string;
  level: string;
  provider?: ProviderAdapter;
  storage: StorageAdapter;
  /** Force regeneration even if an input hash match exists */
  forceRefresh?: boolean;
}

export interface ProfileExtractResult {
  profile: StructuredProfile;
  /** Whether the result was served from cache */
  fromCache: boolean;
  /** Whether the fallback extractor was used */
  usedFallback: boolean;
}

/**
 * Extracts a structured profile from resume and job description.
 * Checks the local cache first by hash; unchanged inputs do not trigger a new AI call.
 */
export async function extractProfile(
  options: ExtractProfileOptions
): Promise<ProfileExtractResult> {
  const {
    resumeText,
    jdText = "",
    targetRole,
    level,
    provider,
    storage,
    forceRefresh = false,
  } = options;

  // 1. Calculate input hash (FR-003)
  const inputHash = await hashProfileInputs(resumeText, jdText, targetRole, level);

  // 2. Check cache if not forcing refresh
  if (!forceRefresh) {
    const cachedRows = await storage.getAll<StructuredProfileRow>("structuredProfiles");
    const matchingRow = cachedRows.find((r) => r.inputHash === inputHash);

    if (matchingRow && matchingRow.json) {
      const parsed = matchingRow.json as StructuredProfile;
      return {
        profile: {
          id: matchingRow.id,
          inputHash: matchingRow.inputHash,
          condensed: matchingRow.condensed,
          skills: parsed.skills || [],
          experiences: parsed.experiences || [],
          ...(parsed.gaps !== undefined ? { gaps: parsed.gaps } : {}),
          ...(parsed.quantifiedClaims !== undefined
            ? { quantifiedClaims: parsed.quantifiedClaims }
            : {}),
          promptVersion: matchingRow.promptVersion,
        },
        fromCache: true,
        usedFallback: false,
      };
    }
  }

  // 3. Perform AI extraction or deterministic fallback
  let extractedSkills: string[] = [];
  let extractedExperiences: ProfileExtractionOutput["experiences"] = [];
  let extractedGaps: string[] | undefined;
  let extractedClaims: string[] | undefined;
  let usedFallback = false;

  if (provider && resumeText.trim().length > 0) {
    try {
      const { systemInstruction, userPrompt } = buildProfileExtractionPrompt(
        resumeText,
        jdText,
        targetRole,
        level
      );

      const messages: ChatMessage[] = [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ];

      const controller = new AbortController();
      const aiRes = await provider.generateObject(messages, ProfileExtractionOutputSchema, {
        signal: controller.signal,
        maxOutputTokens: 2048,
        temperature: 0.1,
      });

      if (aiRes.ok) {
        extractedSkills = aiRes.value.skills;
        extractedExperiences = aiRes.value.experiences;
        extractedGaps = aiRes.value.gaps;
        extractedClaims = aiRes.value.quantifiedClaims;
      } else {
        usedFallback = true;
      }
    } catch {
      usedFallback = true;
    }
  } else {
    usedFallback = true;
  }

  // 4. Fallback execution if AI failed or was not supplied
  if (usedFallback) {
    const fallback = extractFallbackProfile(resumeText, jdText, targetRole);
    extractedSkills = fallback.skills;
    extractedExperiences = fallback.experiences;
    extractedGaps = fallback.gaps;
    extractedClaims = fallback.quantifiedClaims;
  }

  const normalizedExperiences = extractedExperiences.map((e) => ({
    role: e.role,
    highlights: e.highlights,
    ...(e.company ? { company: e.company } : {}),
  }));

  // 5. Produce token-budgeted condensed representation
  const condensed = condenseProfile(
    {
      skills: extractedSkills,
      experiences: normalizedExperiences,
      gaps: extractedGaps,
      quantifiedClaims: extractedClaims,
    },
    { targetRole, level }
  );

  const profileId = `prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const structuredProfile: StructuredProfile = {
    id: profileId,
    inputHash,
    condensed,
    skills: extractedSkills,
    experiences: normalizedExperiences,
    ...(extractedGaps !== undefined ? { gaps: extractedGaps } : {}),
    ...(extractedClaims !== undefined ? { quantifiedClaims: extractedClaims } : {}),
    promptVersion: PROMPT_VERSION,
  };

  // 6. Persist to storage table structuredProfiles
  const row: StructuredProfileRow = {
    id: profileId,
    inputHash,
    json: structuredProfile,
    condensed,
    promptVersion: PROMPT_VERSION,
  };

  await storage.put("structuredProfiles", row);

  return {
    profile: structuredProfile,
    fromCache: false,
    usedFallback,
  };
}
