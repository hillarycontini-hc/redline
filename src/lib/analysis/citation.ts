import { normalize } from "./normalize.ts";

export interface Location {
  start: number;
  end: number;
}

/**
 * Find `quote` in `documentText` after normalisation. Returns the character
 * range in the ORIGINAL text, so the UI can highlight it, or null.
 *
 * This is the enforcement point for ADR 0001. A null here means the flag
 * does not exist.
 */
export function locate(documentText: string, quote: string): Location | null {
  const doc = normalize(documentText);
  const q = normalize(quote);
  if (q.text.length === 0) return null;

  const idx = doc.text.indexOf(q.text);
  if (idx === -1) return null;

  const start = doc.map[idx];
  const end = doc.map[idx + q.text.length - 1] + 1;
  return { start, end };
}
