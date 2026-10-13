// FR-005, NFR-023, ADR-002, ADR-016: Provider adapter contract and unified types.
import type { ZodType } from "zod";

export type ProviderId =
  | "gemini"
  | "openai"
  | "openai-compatible" // MVP
  | "ollama"
  | "webllm" // local (Phase 3)
  | "anthropic"
  | "huggingface"; // later

export type ProviderErrorKind =
  | "auth"
  | "quota"
  | "network"
  | "cors"
  | "model_not_found"
  | "invalid_output"
  | "aborted"
  | "unknown";

export interface ProviderError {
  kind: ProviderErrorKind;
  message: string;
  retryable: boolean;
}

export type Result<T, E = ProviderError> = { ok: true; value: T } | { ok: false; error: E };

export interface Capabilities {
  streaming: boolean;
  jsonMode: "native" | "prompted" | "none";
  maxContextTokens: number | null;
}

export interface GenerateOptions {
  signal: AbortSignal;
  maxOutputTokens: number;
  temperature?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  delta: string;
  isComplete: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  capabilities(): Promise<Capabilities>;
  listModels(): Promise<Result<ModelInfo[]>>;
  testConnection(): Promise<Result<void>>;
  stream(messages: ChatMessage[], opts: GenerateOptions): AsyncIterable<StreamChunk>;
  generateObject<T>(
    messages: ChatMessage[],
    schema: ZodType<T>,
    opts: GenerateOptions
  ): Promise<Result<T>>;
}
