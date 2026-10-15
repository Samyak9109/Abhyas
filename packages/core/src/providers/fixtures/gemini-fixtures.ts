// FR-005: Recorded HTTP response fixtures for Gemini API testing without live network or secrets.

export const GEMINI_FIXTURES = {
  modelsSuccess: {
    models: [
      {
        name: "models/gemini-1.5-flash",
        displayName: "Gemini 1.5 Flash",
        supportedGenerationMethods: ["generateContent", "countTokens"],
        inputTokenLimit: 1048576,
        outputTokenLimit: 8192,
      },
      {
        name: "models/gemini-1.5-pro",
        displayName: "Gemini 1.5 Pro",
        supportedGenerationMethods: ["generateContent", "countTokens"],
        inputTokenLimit: 2097152,
        outputTokenLimit: 8192,
      },
      {
        name: "models/text-embedding-004",
        displayName: "Text Embedding 004",
        supportedGenerationMethods: ["embedContent"],
        inputTokenLimit: 2048,
        outputTokenLimit: 0,
      },
    ],
  },
  authError: {
    error: {
      code: 400,
      message: "API key not valid. Please pass a valid API key.",
      status: "INVALID_ARGUMENT",
    },
  },
  quotaError: {
    error: {
      code: 429,
      message: "Resource has been exhausted (e.g. check quota).",
      status: "RESOURCE_EXHAUSTED",
    },
  },
  streamSseChunks: [
    `data: {"candidates":[{"content":{"parts":[{"text":"Hello! "}]}}]}\n\n`,
    `data: {"candidates":[{"content":{"parts":[{"text":"Welcome to your "}]}}]}\n\n`,
    `data: {"candidates":[{"content":{"parts":[{"text":"mock interview."}]}}]}\n\n`,
  ],
  generateObjectSuccess: {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify({
                status: "ok",
                score: 85,
              }),
            },
          ],
        },
      },
    ],
  },
  generateObjectInvalidJson: {
    candidates: [
      {
        content: {
          parts: [
            {
              text: "This is definitely not json",
            },
          ],
        },
      },
    ],
  },
};
