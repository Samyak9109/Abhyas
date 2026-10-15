// FR-005: Recorded HTTP response fixtures for OpenAI API testing without live network or secrets.

export const OPENAI_FIXTURES = {
  modelsSuccess: {
    data: [
      { id: "gpt-4o", object: "model", created: 1715368132, owned_by: "system" },
      { id: "gpt-4o-mini", object: "model", created: 1721172741, owned_by: "system" },
    ],
  },
  authError: {
    error: {
      message:
        "Incorrect API key provided: sk-invalid. You can find your API key at https://platform.openai.com/account/api-keys.",
      type: "invalid_request_error",
      param: null,
      code: "invalid_api_key",
    },
  },
  quotaError: {
    error: {
      message: "You exceeded your current quota, please check your plan and billing details.",
      type: "insufficient_quota",
      param: null,
      code: "insufficient_quota",
    },
  },
  modelNotFoundError: {
    error: {
      message: "The model `non-existent-model` does not exist or you do not have access to it.",
      type: "invalid_request_error",
      param: "model",
      code: "model_not_found",
    },
  },
  streamSseChunks: [
    `data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Good "},"finish_reason":null}]}\n\n`,
    `data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"morning. "},"finish_reason":null}]}\n\n`,
    `data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Let's begin."},"finish_reason":null}]}\n\n`,
    `data: [DONE]\n\n`,
  ],
  generateObjectSuccess: {
    id: "chatcmpl-2",
    choices: [
      {
        message: {
          role: "assistant",
          content: JSON.stringify({
            status: "ok",
            score: 85,
          }),
        },
        finish_reason: "stop",
      },
    ],
  },
};
