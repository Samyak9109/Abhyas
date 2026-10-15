// FR-002, NFR-002: Off-main-thread Web Worker for parsing PDF, DOCX, and TXT resumes.
import { parseDocxBuffer, parsePdfBuffer, parseTxtBuffer } from "../services/document-parser";

self.onmessage = async (e: MessageEvent) => {
  const { id, arrayBuffer, fileType } = e.data;

  try {
    if (fileType === "pdf") {
      const { text, isScanned } = await parsePdfBuffer(arrayBuffer);
      self.postMessage({ id, ok: true, text, isScanned });
    } else if (fileType === "docx") {
      const { text } = await parseDocxBuffer(arrayBuffer);
      self.postMessage({ id, ok: true, text });
    } else if (fileType === "txt") {
      const { text } = await parseTxtBuffer(arrayBuffer);
      self.postMessage({ id, ok: true, text });
    } else {
      self.postMessage({ id, ok: false, error: "Unsupported file type" });
    }
  } catch (err: unknown) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "Failed to parse document in worker",
    });
  }
};
