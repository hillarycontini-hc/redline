/**
 * Reading JSON back from a model. Shared by every call the analysis makes, so
 * one fence-stripping rule covers all of them.
 */

/**
 * Models sometimes wrap JSON in a code fence despite instructions. Strip it,
 * parse, and insist the result is an object. Anything else is an error, not a
 * guess.
 */
export function parseJsonObject(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1];

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Model response was not valid JSON");
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Model response did not match the expected shape");
  }

  return data as Record<string, unknown>;
}
