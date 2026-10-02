/**
 * Browser-side text extraction. This module runs in the client only. The file
 * never leaves the browser; only the string it returns does.
 *
 * Phase 1 handles plain text. PDF and DOCX need parsing libraries, which are
 * pending the product owner's approval (CLAUDE.md: ask before adding a
 * dependency). Until then they return a clear not-supported result.
 */

export type ExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "no-text" | "unsupported-type"; message: string };

const TEXT_TYPES = new Set(["text/plain", "text/markdown"]);
const TEXT_EXTENSIONS = [".txt", ".md", ".text"];

/** Below this many non-whitespace characters we assume a scan or an empty file. */
export const MIN_USABLE_CHARS = 200;

export async function extractText(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const isText =
    TEXT_TYPES.has(file.type) || TEXT_EXTENSIONS.some((e) => name.endsWith(e));

  if (!isText) {
    return {
      ok: false,
      reason: "unsupported-type",
      message:
        "This version reads plain text files only. PDF and Word support is coming. A photograph or an image of a document will not be supported, because Redline cannot cite text it might have misread.",
    };
  }

  const text = await file.text();
  return checkUsable(text);
}

export function checkUsable(text: string): ExtractResult {
  const usable = text.replace(/\s/g, "").length;
  if (usable < MIN_USABLE_CHARS) {
    return {
      ok: false,
      reason: "no-text",
      message:
        "Redline could not find enough readable text in this file. If it is a photograph or an image of a document, Redline cannot read it, because a citation into misread text is worse than none.",
    };
  }
  return { ok: true, text };
}
