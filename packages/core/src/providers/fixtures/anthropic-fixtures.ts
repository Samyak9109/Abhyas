// FR-005, M7.1: Recorded HTTP response fixtures for Anthropic Messages API testing.

export const ANTHROPIC_FIXTURES = {
  modelsSuccess: {
    data: [
      { id: "claude-3-5-sonnet-20241022", display_name: "Claude 3.5 Sonnet", type: "model" },
      { id: "claude-3-5-haiku-20241022", display_name: "Claude 3.5 Haiku", type: "model" },
      { id: "claude-3-opus-20240229", display_name: "Claude 3 Opus", type: "model" },
    ],
    has_more: false,
  },
  authError: {
    type: "error",
    error: {
      type: "authentication_error",
      message: "invalid x-api-key",
    },
  },
  quotaError: {
    type: "error",
    error: {
      type: "rate_limit_error",
      message: "Number of request tokens has exceeded your per-minute rate limit",
    },
  },
  modelNotFoundError: {
    type: "error",
    error: {
      type: "not_found_error",
      message: "model: non-existent-model not found",
    },
  },
  streamSseChunks: [
    `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"claude-3-5-sonnet-20241022"}}\n\n`,
    `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Good "}}\n\n`,
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"morning. "}}\n\n`,
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Let's begin."}}\n\n`,
    `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
    `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
  ],
  generateObjectSuccess: {
    id: "msg_2",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "ok",
          score: 85,
        }),
      },
    ],
    model: "claude-3-5-sonnet-20241022",
    stop_reason: "end_turn",
  },
};
