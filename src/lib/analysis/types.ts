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

export interface Analysis {
  summary: string;
  flags: Flag[];
  /** Kept for logging and eval. Never rendered as flags. */
  dropped: DroppedFlag[];
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
