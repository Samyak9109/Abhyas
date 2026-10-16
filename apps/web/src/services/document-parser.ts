// FR-002, NFR-001, NFR-002: Client-side document parsing service for PDF, DOCX, and TXT.
// Extracts plain text strictly in the browser with zero outbound network requests.
// PDF and DOCX parsers are dynamically imported on demand to respect initial bundle budgets (NFR-001).

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (FR-002)

interface DocumentParseResult {
  ok: boolean;
  text: string;
  isScanned?: boolean;
  error?: string;
}

/**
 * Extracts raw text from an ArrayBuffer of a PDF document.
 * Detects image-only/scanned PDFs where extracted text is under threshold.
 */
export async function parsePdfBuffer(
  arrayBuffer: ArrayBuffer
): Promise<{ text: string; isScanned: boolean }> {
  const pdfjsLib = await import("pdfjs-dist");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageStr = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ");
    pageTexts.push(pageStr.trim());
  }

  const fullText = pageTexts.filter(Boolean).join("\n\n");
  const isScanned = pdf.numPages > 0 && fullText.trim().length < 10;

  return { text: fullText, isScanned };
}

/**
 * Extracts raw text from an ArrayBuffer of a DOCX document using mammoth.
 */
export async function parseDocxBuffer(arrayBuffer: ArrayBuffer): Promise<{ text: string }> {
  const mammoth = await import("mammoth");
  const extractFn =
    mammoth.extractRawText ??
    (mammoth as unknown as { default: { extractRawText: typeof mammoth.extractRawText } }).default
      ?.extractRawText;
  const result = await extractFn({ arrayBuffer });
  return { text: result.value.trim() };
}

/**
 * Decodes plain text from a TXT document.
 */
export async function parseTxtBuffer(arrayBuffer: ArrayBuffer): Promise<{ text: string }> {
  const decoder = new TextDecoder("utf-8");
  return { text: decoder.decode(arrayBuffer).trim() };
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = () => {
      reject(reader.error || new Error("Failed to read file"));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses an uploaded resume file (PDF, DOCX, or TXT).
 * Validates file size (max 5 MB) and type before processing.
 * Runs in-browser only (zero network activity).
 */
export async function parseDocument(file: File): Promise<DocumentParseResult> {
  // 1. File size check (FR-002: max 5 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      text: "",
      error: "File exceeds the 5 MB limit. Please upload a smaller file or paste text directly.",
    };
  }

  // 2. Extension detection
  const fileName = file.name.toLowerCase();
  let fileType: "pdf" | "docx" | "txt" | null = null;
  if (fileName.endsWith(".pdf")) {
    fileType = "pdf";
  } else if (fileName.endsWith(".docx")) {
    fileType = "docx";
  } else if (fileName.endsWith(".txt")) {
    fileType = "txt";
  }

  if (!fileType) {
    return {
      ok: false,
      text: "",
      error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
    };
  }

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // 3. Try parsing via Web Worker if running in a real browser (NFR-002 off-main-thread)
    const isTestEnv =
      typeof process !== "undefined" &&
      (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

    if (!isTestEnv && typeof Worker !== "undefined" && typeof window !== "undefined") {
      try {
        const workerResult = await parseViaWorker(arrayBuffer, fileType);
        return workerResult;
      } catch {
        // Fall back to direct parsing if worker initialization fails (e.g., in restricted sandboxes)
      }
    }

    // Direct fallback
    return await parseBufferDirect(arrayBuffer, fileType);
  } catch (err: unknown) {
    return {
      ok: false,
      text: "",
      error:
        err instanceof Error ? err.message : "Failed to parse document. Please paste text instead.",
    };
  }
}

async function parseBufferDirect(
  arrayBuffer: ArrayBuffer,
  fileType: "pdf" | "docx" | "txt"
): Promise<DocumentParseResult> {
  if (fileType === "pdf") {
    const { text, isScanned } = await parsePdfBuffer(arrayBuffer);
    if (isScanned) {
      return {
        ok: false,
        text: "",
        isScanned: true,
        error:
          "No readable text found. This document appears to be a scanned or image-only PDF. Abhyas does not run OCR in v1; please paste your resume text below.",
      };
    }
    return { ok: true, text };
  }

  if (fileType === "docx") {
    const { text } = await parseDocxBuffer(arrayBuffer);
    if (!text.trim()) {
      return {
        ok: false,
        text: "",
        error: "DOCX file is empty. Please check the document or paste text directly.",
      };
    }
    return { ok: true, text };
  }

  const { text } = await parseTxtBuffer(arrayBuffer);
  if (!text.trim()) {
    return {
      ok: false,
      text: "",
      error: "File is empty. Please check the document or paste text directly.",
    };
  }
  return { ok: true, text };
}

function parseViaWorker(
  arrayBuffer: ArrayBuffer,
  fileType: "pdf" | "docx" | "txt"
): Promise<DocumentParseResult> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL("../workers/parser.worker.ts", import.meta.url), {
        type: "module",
      });

      const messageId = Math.random().toString(36).substring(2);

      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Document parsing timed out"));
      }, 30000);

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.id === messageId) {
          clearTimeout(timer);
          worker.terminate();
          if (e.data.ok) {
            if (e.data.isScanned) {
              resolve({
                ok: false,
                text: "",
                isScanned: true,
                error:
                  "No readable text found. This document appears to be a scanned or image-only PDF. Abhyas does not run OCR in v1; please paste your resume text below.",
              });
            } else {
              resolve({ ok: true, text: e.data.text });
            }
          } else {
            resolve({
              ok: false,
              text: "",
              error: e.data.error || "Failed to parse document",
            });
          }
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timer);
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ id: messageId, arrayBuffer: arrayBuffer.slice(0), fileType });
    } catch (workerErr) {
      reject(workerErr);
    }
  });
}
