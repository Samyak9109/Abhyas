// Ambient module declarations for mammoth and Vite asset imports.
declare module "mammoth" {
  export interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>;
}

declare module "*?url" {
  const src: string;
  export default src;
}
