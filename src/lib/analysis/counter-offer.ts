import { parseJsonObject } from "./json.ts";
import { normalize } from "./normalize.ts";
import { COUNTER_OFFER_SYSTEM_PROMPT, buildCounterOfferPrompt } from "./prompt.ts";
import { requiresCounterOffer } from "./red-lines.ts";
import type {
  Analysis,
  CallModel,
  CounterOfferRequest,
  Flag,
  MissingCounterOffer,
} from "./types.ts";

/**
 * The second pass of the analysis, and part of the seam: nothing above it
 * knows a second call happened.
 *
 * Spec §Counter-offers and CONTEXT.md: Critical and Serious always carry
 * replacement wording, Worth knowing never does. The first pass leaves gaps —
 * a model that produced eight flags will sometimes produce seven offers — and
 * a Critical flag shown with no wording to send back is the gap this closes.
 *
 * Two rules it holds without exception:
 *
 * - A flag is never dropped for want of a counter-offer. Only an unlocatable
 *   source sentence drops a flag (ADR 0001). A flag still without wording after
 *   this pass is shown anyway, and the gap is recorded on the analysis.
 * - Worth-knowing flags are never sent for drafting and never receive wording.
 */

/** Trimmed wording, or "" if there is none worth showing. */
function offerOf(flag: Flag): string {
  return flag.counterOffer?.trim() ?? "";
}

function gapOf(flag: Flag): MissingCounterOffer {
  return {
    clauseType: flag.clauseType,
    severity: flag.severity,
    sourceSentence: flag.sourceSentence,
  };
}

/** Which flags owe the reader wording and have none. */
function needsWording(flag: Flag): boolean {
  return requiresCounterOffer(flag.severity) && offerOf(flag) === "";
}

/**
 * Fill in the counter-offers the first pass left out, in one further model
 * call for the whole batch. Returns a new Analysis; the one passed in is not
 * touched.
 */
export async function withCounterOffers(
  analysis: Analysis,
  callModel: CallModel,
): Promise<Analysis> {
  const owed = analysis.flags.filter(needsWording);
  if (owed.length === 0) return analysis;

  // ref is the position in this batch, and it is the only thing tying a
  // drafted counter-offer back to the flag — and so to the source sentence —
  // it was asked about.
  const requests: CounterOfferRequest[] = owed.map((flag, ref) => ({
    ref,
    clauseType: flag.clauseType,
    severity: flag.severity,
    sourceSentence: flag.sourceSentence,
    consequence: flag.consequence,
  }));

  let drafted = new Map<number, string>();
  try {
    const raw = await callModel([
      { role: "system", content: COUNTER_OFFER_SYSTEM_PROMPT },
      { role: "user", content: buildCounterOfferPrompt(requests) },
    ]);
    drafted = readCounterOffers(raw, requests);
  } catch (error) {
    // The reading itself came back. Losing it because the drafting call fell
    // over would cost the reader more than the missing wording does, so the
    // failure is recorded below as a gap rather than thrown.
    console.warn("[analyze] the counter-offer call did not come back", error);
  }

  const filled = new Map<Flag, string>();
  for (const [ref, flag] of owed.entries()) {
    const offer = drafted.get(ref);
    if (offer) filled.set(flag, offer);
  }

  const flags = analysis.flags.map((flag) => {
    const offer = filled.get(flag);
    return offer ? { ...flag, counterOffer: offer } : flag;
  });

  return {
    ...analysis,
    flags,
    missingCounterOffers: flags.filter(needsWording).map(gapOf),
  };
}

/**
 * Read the drafted wording back, keyed to the refs that were sent. Anything
 * that cannot be tied to a clause that was asked about is ignored: wording
 * attached to the wrong sentence is worse than no wording.
 */
function readCounterOffers(
  raw: string,
  requests: readonly CounterOfferRequest[],
): Map<number, string> {
  const found = new Map<number, string>();

  const list = parseJsonObject(raw).counterOffers;
  if (!Array.isArray(list)) return found;

  const byRef = new Map(requests.map((r) => [r.ref, r]));

  // A clauseType is a usable key only while it is unique in the batch. Two
  // flags of the same type would make it ambiguous, and an ambiguous key is
  // no key at all.
  const refsByType = new Map<string, number[]>();
  for (const r of requests) {
    const refs = refsByType.get(r.clauseType) ?? [];
    refs.push(r.ref);
    refsByType.set(r.clauseType, refs);
  }

  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;

    const offer = typeof e.counterOffer === "string" ? e.counterOffer.trim() : "";
    if (offer.length === 0) continue;

    const ref = refOf(e, byRef, refsByType);
    if (ref === null || found.has(ref)) continue;

    // The source sentence handed back unchanged is not a replacement for it.
    const request = byRef.get(ref);
    if (
      request &&
      normalize(offer).text === normalize(request.sourceSentence).text
    ) {
      continue;
    }

    found.set(ref, offer);
  }

  return found;
}

function refOf(
  entry: Record<string, unknown>,
  byRef: Map<number, CounterOfferRequest>,
  refsByType: Map<string, number[]>,
): number | null {
  const raw = entry.ref;
  const asNumber =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : null;
  if (asNumber !== null && byRef.has(asNumber)) return asNumber;

  if (typeof entry.clauseType === "string") {
    const refs = refsByType.get(entry.clauseType);
    if (refs && refs.length === 1) return refs[0];
  }

  return null;
}
