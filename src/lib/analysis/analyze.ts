import { locate } from "./citation.ts";
import { withCounterOffers } from "./counter-offer.ts";
import { parseJsonObject } from "./json.ts";
import { lowerTier, requiresCounterOffer } from "./red-lines.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.ts";
import type {
  Analysis,
  CallModel,
  DroppedFlag,
  Flag,
  MissingCounterOffer,
  ModelFlag,
  ModelResponse,
  RedLine,
  Severity,
} from "./types.ts";

export type { CallModel, ChatMessage } from "./types.ts";

export interface AnalyzeInput {
  documentText: string;
  redLines: readonly RedLine[];
  callModel: CallModel;
}

/**
 * The analysis module. This is the seam: (documentText, redLines) in,
 * (summary, flags) out. It is the single place the model is called for
 * analysis and the single place the citation check runs.
 *
 * One call reads the document. A second one runs only when the first left a
 * Critical or Serious flag without replacement wording, and the route and the
 * screen above this never learn which happened.
 */
export async function analyze(input: AnalyzeInput): Promise<Analysis> {
  const { documentText, redLines, callModel } = input;

  const raw = await callModel([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(documentText, redLines) },
  ]);

  const parsed = parseModelResponse(raw);
  const read = enforce(documentText, redLines, parsed);
  return withCounterOffers(read, callModel);
}

/**
 * Turn a model response into an Analysis, applying every rule that does not
 * depend on the model's judgment. Pure; exported for tests.
 */
export function enforce(
  documentText: string,
  redLines: readonly RedLine[],
  response: ModelResponse,
): Analysis {
  const byType = new Map(redLines.map((r) => [r.clauseType, r]));
  const flags: Flag[] = [];
  const dropped: DroppedFlag[] = [];

  for (const mf of response.flags) {
    if (!isModelFlag(mf)) {
      dropped.push({ reason: "malformed" });
      continue;
    }

    // Spec D2/D3: the red lines in force decide which clause types exist and
    // what tier they earn. A type not in the list is not flagged.
    const redLine = byType.get(mf.clauseType);
    if (!redLine) {
      dropped.push({
        reason: "unknown-clause-type",
        clauseType: mf.clauseType,
        sourceSentence: mf.sourceSentence,
      });
      continue;
    }

    // ADR 0001: locatable or it does not exist. Silence is the correct failure.
    const location = locate(documentText, mf.sourceSentence);
    if (!location) {
      dropped.push({
        reason: "unlocatable-source",
        clauseType: mf.clauseType,
        sourceSentence: mf.sourceSentence,
      });
      continue;
    }

    // Uncertainty changes severity, not tone.
    const severity: Severity =
      mf.confidence === "low" ? lowerTier(redLine.severity) : redLine.severity;

    const flag: Flag = {
      clauseType: mf.clauseType,
      severity,
      // Quote the document's own characters, not the model's copy of them.
      sourceSentence: documentText.slice(location.start, location.end),
      location,
      consequence: mf.consequence.trim(),
    };

    // Spec D5: never on Worth knowing. R6: on Critical and Serious.
    const offer = mf.counterOffer?.trim();
    if (requiresCounterOffer(severity) && offer) flag.counterOffer = offer;

    flags.push(flag);
  }

  // Ranked by tier, then by where they appear in the document.
  flags.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.location.start - b.location.start,
  );

  // The gaps as the first pass left them. The drafting pass closes what it
  // can and rewrites this list; a flag is never dropped for being on it.
  const missingCounterOffers: MissingCounterOffer[] = flags
    .filter((f) => requiresCounterOffer(f.severity) && f.counterOffer === undefined)
    .map((f) => ({
      clauseType: f.clauseType,
      severity: f.severity,
      sourceSentence: f.sourceSentence,
    }));

  return {
    summary:
      typeof response.summary === "string" ? response.summary.trim() : "",
    flags,
    dropped,
    missingCounterOffers,
  };
}

function severityRank(s: Severity): number {
  return s === "Critical" ? 0 : s === "Serious" ? 1 : 2;
}

function isModelFlag(x: unknown): x is ModelFlag {
  if (typeof x !== "object" || x === null) return false;
  const f = x as Record<string, unknown>;
  return (
    typeof f.clauseType === "string" &&
    typeof f.sourceSentence === "string" &&
    typeof f.consequence === "string" &&
    (f.confidence === "high" || f.confidence === "low") &&
    (f.counterOffer === undefined || typeof f.counterOffer === "string")
  );
}

/**
 * Parse the reading back and insist on the top-level shape. Anything else is
 * an error, not a guess.
 */
export function parseModelResponse(raw: string): ModelResponse {
  const data = parseJsonObject(raw);

  if (typeof data.summary !== "string" || !Array.isArray(data.flags)) {
    throw new Error("Model response did not match the expected shape");
  }

  return data as unknown as ModelResponse;
}
