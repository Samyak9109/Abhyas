// FR-005, M7.1: Recorded HTTP response fixtures for Hugging Face Inference API testing.

export const HUGGINGFACE_FIXTURES = {
  modelsSuccess: [
    { id: "meta-llama/Llama-3.2-3B-Instruct", pipeline_tag: "text-generation" },
    { id: "Qwen/Qwen2.5-7B-Instruct", pipeline_tag: "text-generation" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", pipeline_tag: "text-generation" },
  ],
  authError: {
    error: "Invalid username or password / token.",
  },
  quotaError: {
    error: "Rate limit reached. Please wait a few minutes before trying again.",
  },
  modelNotFoundError: {
    error: "Model non-existent-model does not exist or is not available on serverless inference.",
  },
  streamSseChunks: [
    `data: {"id":"hf-1","choices":[{"delta":{"content":"Good "},"finish_reason":null}]}\n\n`,
    `data: {"id":"hf-1","choices":[{"delta":{"content":"morning. "},"finish_reason":null}]}\n\n`,
    `data: {"id":"hf-1","choices":[{"delta":{"content":"Let's begin."},"finish_reason":null}]}\n\n`,
    `data: [DONE]\n\n`,
  ],
  generateObjectSuccess: {
    id: "hf-2",
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
