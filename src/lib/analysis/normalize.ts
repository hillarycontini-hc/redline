/**
 * Normalisation for the citation check. Whitespace and quote characters only,
 * nothing looser (spec, Testing Decisions). Anything more permissive lets
 * paraphrase through, which is the bug the rule exists to catch.
 */

const QUOTE_MAP: Record<string, string> = {
  "\u2018": "'", // ‘
  "\u2019": "'", // ’
  "\u201A": "'", // ‚
  "\u201B": "'", // ‛
  "\u2032": "'", // ′
  "\u201C": '"', // “
  "\u201D": '"', // ”
  "\u201E": '"', // „
  "\u201F": '"', // ‟
  "\u2033": '"', // ″
};

const WHITESPACE = /\s/;

export interface Normalized {
  text: string;
  /** For each character in `text`, the index of the original character it came from. */
  map: number[];
}

/**
 * Collapse whitespace runs to a single space, fold curly quotes to straight,
 * trim the ends, and remember where each surviving character came from.
 */
export function normalize(input: string): Normalized {
  const out: string[] = [];
  const map: number[] = [];
  let pendingSpaceFrom = -1;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (WHITESPACE.test(ch)) {
      if (pendingSpaceFrom === -1) pendingSpaceFrom = i;
      continue;
    }
    if (pendingSpaceFrom !== -1) {
      if (out.length > 0) {
        out.push(" ");
        map.push(pendingSpaceFrom);
      }
      pendingSpaceFrom = -1;
    }
    out.push(QUOTE_MAP[ch] ?? ch);
    map.push(i);
  }

  return { text: out.join(""), map };
}
