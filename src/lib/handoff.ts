/**
 * How the landing page's entry passes a document to /read.
 *
 * sessionStorage, under one key, read once and cleared. Not a query parameter:
 * forty pages of someone's contract must not end up in a URL, because URLs get
 * logged by every hop they pass through.
 */

const KEY = "redline.handoff.document";

export interface Handoff {
  /** What to call the document on screen. A filename, or a stand-in. */
  name: string;
  text: string;
}

export function stashHandoff(handoff: Handoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(handoff));
  } catch {
    // A browser with storage switched off still gets to /read, just empty.
  }
}

/** Read the handed-over document and clear it, so a reload starts clean. */
export function takeHandoff(): Handoff | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Handoff>;
    if (typeof parsed.text !== "string" || parsed.text.trim().length === 0) {
      return null;
    }
    return {
      name: typeof parsed.name === "string" ? parsed.name : "Pasted text",
      text: parsed.text,
    };
  } catch {
    return null;
  }
}
