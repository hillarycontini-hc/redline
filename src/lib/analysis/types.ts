/**
 * Core types. Vocabulary follows CONTEXT.md: document, source sentence, flag,
 * severity, counter-offer, red line. Nothing here is a "risk score".
 */

export const SEVERITIES = ["Critical", "Serious", "Worth knowing"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One entry in the user's list of what they refuse to accept. */
export interface RedLine {
  /** Stable identifier, e.g. "personal-guarantee". Never bare "redline". */
  clauseType: string;
  /** Short human label shown in the UI. */
  label: string;
  /** What to look for. Sent to the model verbatim. */
  description: string;
  /** The tier a match earns. A user's entry overrides the seeded tier. */
  severity: Severity;
}

/** One identified risk, tied to exactly one source sentence. */
export interface Flag {
  clauseType: string;
  severity: Severity;
  /** Verbatim from the document. Locatable, or the flag does not exist. */
  sourceSentence: string;
  /** Character range of sourceSentence in the original document text. */
  location: { start: number; end: number };
  /** What happens to the reader if they sign it as written. Plain language. */
  consequence: string;
  /** Replacement language. Present on Critical and Serious, never on Worth knowing. */
  counterOffer?: string;
}

/** A flag the model produced that we refused to show, and why. */
export interface DroppedFlag {
  reason: "unlocatable-source" | "unknown-clause-type" | "malformed";
  clauseType?: string;
  sourceSentence?: string;
}

/**
 * A Critical or Serious flag that reached the reader with no replacement
 * wording. Recorded the way a dropped flag is, so the gap is visible rather
 * than silent. The flag itself is still shown: it is never dropped for want of
 * a counter-offer, only for want of a source sentence.
 */
export interface MissingCounterOffer {
  clauseType: string;
  severity: Severity;
  sourceSentence: string;
}

export interface Analysis {
  summary: string;
  flags: Flag[];
  /** Kept for logging and eval. Never rendered as flags. */
  dropped: DroppedFlag[];
  /** Flags shown without a counter-offer, after the drafting pass. */
  missingCounterOffers: MissingCounterOffer[];
}

/**
 * Whether the reading was kept in the reader's library, and why not when it was
 * not. Three reasons, because the reader is owed different words for each and
 * one of them is not their doing. Nothing here interrupts the reading.
 */
export type SavedTo =
  | { kept: true; documentId: string }
  | { kept: false; why: "no-account" | "not-signed-in" | "would-not-keep" };

/**
 * What POST /api/analyze sends back. Dropped flags are counted so the reader
 * is told how many were refused, but their sentences are never sent: an
 * unlocatable sentence is the one thing the reader must not be shown.
 */
export interface AnalyzeResponse {
  summary: string;
  flags: Flag[];
  droppedCount: number;
  saved: SavedTo;
}

/** What the model is asked to return. Validated before it becomes a Flag. */
export interface ModelFlag {
  clauseType: string;
  sourceSentence: string;
  consequence: string;
  /** "low" lowers the tier by one step. Uncertainty changes severity, not tone. */
  confidence: "high" | "low";
  counterOffer?: string;
}

export interface ModelResponse {
  summary: string;
  flags: ModelFlag[];
}

/**
 * One clause sent back to the model for replacement wording, when the first
 * pass left a Critical or Serious flag without any. `ref` is carried through
 * the call and back so each drafted counter-offer returns to the flag — and so
 * to the source sentence — it was asked about.
 */
export interface CounterOfferRequest {
  ref: number;
  clauseType: string;
  severity: Severity;
  sourceSentence: string;
  consequence: string;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** The only thing the analysis needs from the outside world. Stubbed in tests. */
export type CallModel = (messages: ChatMessage[]) => Promise<string>;

/**
 * One sentence an answer leaned on. Verbatim from the document and locatable,
 * or it does not exist — question-box answers inherit ADR 0001 exactly as
 * flags do, because both are claims about the document.
 */
export interface Citation {
  sourceSentence: string;
  /** Character range of sourceSentence in the original document text. */
  location: { start: number; end: number };
}

/** A quote the model offered that could not be placed in the document. */
export interface DroppedCitation {
  reason: "unlocatable-quote" | "malformed";
  quote?: string;
}

/**
 * What the question box returns. An empty citations list means one thing and
 * only one thing: the answer is the fixed response saying the document does
 * not address the question. There is no third state, so nothing above this can
 * render an ungrounded answer as though it were grounded.
 */
export interface QuestionAnswer {
  answer: string;
  citations: Citation[];
  /** Kept for logging and eval. Never rendered. */
  dropped: DroppedCitation[];
}

/**
 * What POST /api/ask sends back. Dropped quotes are counted, never sent: an
 * unplaceable quote is the one thing the reader must not be shown.
 */
export interface AskResponse {
  answer: string;
  citations: Citation[];
  droppedCount: number;
}

/** What the model is asked to return for a question. Grounded before it is shown. */
export interface ModelAnswer {
  /** False when the model itself says the document is silent on the question. */
  addressed: boolean;
  answer: string;
  /** Quotes as the model gave them. Each is placed in the document, or dropped. */
  citations: unknown[];
}
