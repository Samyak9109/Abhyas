// FR-005, FR-023: Recorded HTTP response fixtures for Ollama API testing without live network or server.

export const OLLAMA_FIXTURES = {
  modelsSuccess: {
    models: [
      {
        name: "llama3.2:latest",
        model: "llama3.2:latest",
        modified_at: "2026-10-10T12:00:00Z",
        size: 2019393189,
        digest: "a80c4f17df56",
        details: {
          parent_model: "",
          format: "gguf",
          family: "llama",
          families: ["llama"],
          parameter_size: "3.2B",
          quantization_level: "Q4_K_M",
        },
      },
      {
        name: "qwen2.5:latest",
        model: "qwen2.5:latest",
        modified_at: "2026-10-10T12:00:00Z",
        size: 986000000,
        digest: "b91d5e28c031",
        details: {
          parent_model: "",
          format: "gguf",
          family: "qwen2",
          families: ["qwen2"],
          parameter_size: "1.5B",
          quantization_level: "Q4_K_M",
        },
      },
    ],
  },
  modelNotFoundError: {
    error: "model 'non-existent' not found, try pulling it first",
  },
  streamNdjsonChunks: [
    JSON.stringify({
      model: "llama3.2:latest",
      created_at: "2026-10-18T10:00:00Z",
      message: { role: "assistant", content: "Good " },
      done: false,
    }) + "\n",
    JSON.stringify({
      model: "llama3.2:latest",
      created_at: "2026-10-18T10:00:00Z",
      message: { role: "assistant", content: "morning. " },
      done: false,
    }) + "\n",
    JSON.stringify({
      model: "llama3.2:latest",
      created_at: "2026-10-18T10:00:00Z",
      message: { role: "assistant", content: "Let's begin." },
      done: false,
    }) + "\n",
    JSON.stringify({
      model: "llama3.2:latest",
      created_at: "2026-10-18T10:00:00Z",
      done: true,
      total_duration: 120000000,
      prompt_eval_count: 24,
      eval_count: 8,
    }) + "\n",
  ],
  generateObjectSuccess: {
    model: "llama3.2:latest",
    created_at: "2026-10-18T10:00:00Z",
    message: {
      role: "assistant",
      content: JSON.stringify({
        status: "ok",
        score: 85,
      }),
    },
    done: true,
  },
};
