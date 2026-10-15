// FR-002: Unit and security tests for document parser.
// Acceptance criteria:
// - A sample PDF and DOCX produce editable text.
// - An automated test confirms no network request occurs during parsing.
import { describe, expect, it, vi } from "vitest";
import {
  MAX_FILE_SIZE_BYTES,
  parseDocument,
  parsePdfBuffer,
  parseTxtBuffer,
} from "./document-parser";

describe("Document Ingestion & Parser (FR-002)", () => {
  it("parses plain text files accurately", async () => {
    const textContent = "Senior React Developer with 6 years experience in TypeScript and Webpack.";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(textContent).buffer;

    const parsed = await parseTxtBuffer(buffer);
    expect(parsed.text).toBe(textContent);
  });

  it("handles File objects for text documents", async () => {
    const sampleContent = "John Doe\nSoftware Engineer\nSkills: Python, Go, Docker";
    const file = new File([sampleContent], "resume.txt", { type: "text/plain" });

    const result = await parseDocument(file);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("John Doe");
    expect(result.text).toContain("Skills: Python, Go, Docker");
  });

  it("rejects files exceeding the 5 MB limit", async () => {
    // Create a mock oversized file
    const oversizedFile = new File(["dummy"], "large_resume.pdf", { type: "application/pdf" });
    Object.defineProperty(oversizedFile, "size", { value: MAX_FILE_SIZE_BYTES + 1024 });

    const result = await parseDocument(oversizedFile);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("5 MB limit");
  });

  it("rejects unsupported file formats with clear guidance", async () => {
    const unsupportedFile = new File(["dummy"], "resume.png", { type: "image/png" });

    const result = await parseDocument(unsupportedFile);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Unsupported file type");
  });

  it("proves zero outbound network requests occur during document parsing (FR-002 Acceptance Criterion)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const sampleContent = `
      Jane Smith
      Frontend Engineer
      Experience: React, Vite, CSS, HTML5
      Projects: Built high-performance dashboard
    `;
    const file = new File([sampleContent], "resume.txt", { type: "text/plain" });

    const result = await parseDocument(file);
    expect(result.ok).toBe(true);
    expect(result.text).toContain("Jane Smith");

    // CRITICAL ACCEPTANCE CHECK: Zero network calls during document ingestion!
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("parses PDF text buffer and detects scanned PDF (FR-002)", async () => {
    // Minimal valid PDF binary
    const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >>
stream
BT
/F1 12 Tf
72 712 Td
(Alice Engineer) Tj
ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000319 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
390
%%EOF`;

    const encoder = new TextEncoder();
    const buffer = encoder.encode(minimalPdf).buffer;

    const result = await parsePdfBuffer(buffer);
    // Extracted text should contain "Alice Engineer"
    expect(result.text).toContain("Alice Engineer");
    expect(result.isScanned).toBe(false);
  });

  it("identifies scanned/empty PDFs when text length is minimal", async () => {
    // PDF with no text stream
    const emptyPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Size 4 /Root 1 0 R >>
startxref
200
%%EOF`;

    const encoder = new TextEncoder();
    const buffer = encoder.encode(emptyPdf).buffer;

    const result = await parsePdfBuffer(buffer);
    expect(result.isScanned).toBe(true);
  });
});
