/**
 * The two release gates, and the one measure that is reported rather than
 * gating. PRD §4.2, §4.4 and §4.3; spec Testing Decisions and D6, D7, D9.
 *
 * Everything here is pure: an entry and the analysis that came back for it in,
 * a verdict out. The runner in scripts/gates.ts gets the analysis from the
 * live model; the tests get it from the readings recorded on disk. Both judge
 * it with this module, so the gate that runs before a release is the gate the
 * suite exercises.
 *
 * What gates:
 *   - catches what matters: every Critical clause identified in advance is
 *     flagged. A miss blocks the release (PRD §4.2).
 *   - clean document: zero Critical flags, at most two flags of any tier, and
 *     a summary saying the document looks reasonable (PRD §4.4, spec D6).
 *
 * What does not gate:
 *   - severity defensible: how often the tier returned matches the tier
 *     identified, and whether anything is off by two tiers. Tracked per
 *     release, never allowed to change the verdict (spec D9).
 *
 * Citations are checked too. They cannot fail here, because the analysis seam
 * drops a flag it cannot place before anyone sees it, and CI gates the same
 * property. They are checked anyway: a release gate that quietly stopped
 * checking ADR 0001 would be worse than no gate at all.
 */
import { locate } from "../analysis/citation.ts";
import { SEVERITIES } from "../analysis/types.ts";
import type { Analysis, Severity } from "../analysis/types.ts";
import type { GoldEntry, Kind, Provenance } from "./entries.ts";

/** Spec D6. More flags than this on a clean document and the gate fails. */
export const CLEAN_MAX_FLAGS = 2;

/** PRD §4.3. Reported against this, never gated on it. */
export const SEVERITY_AGREEMENT_TARGET = 0.8;

export interface CatchesVerdict {
  /** Critical clauses identified in advance. */
  identified: number;
  caught: number;
  /** The clause types that were identified as Critical and never flagged. */
  missing: string[];
  passed: boolean;
}

export interface CleanVerdict {
  criticalFlags: number;
  flagCount: number;
  saysItLooksReasonable: boolean;
  /** Which of the three conditions it failed, in words. */
  failures: string[];
  passed: boolean;
}

export interface TierDisagreement {
  clauseType: string;
  identified: Severity;
  returned: Severity;
  /** 1 or 2. Two is a bug under PRD §4.3, and still does not gate. */
  tiers: number;
}

export interface SeverityVerdict {
  /** Identified clauses that were flagged, so a tier could be compared. */
  compared: number;
  agreed: number;
  /** Identified clauses never flagged, so there was no tier to compare. */
  notFlagged: number;
  disagreements: TierDisagreement[];
  offByTwo: TierDisagreement[];
  /** null when there was nothing to compare. */
  agreement: number | null;
}

export interface CitationVerdict {
  checked: number;
  /** Flags whose source sentence could not be found in the document. */
  unlocatable: string[];
  passed: boolean;
}

export interface DocumentVerdict {
  name: string;
  provenance: Provenance;
  kind: Kind;
  /** null on a clean document: nothing was identified to catch. */
  catches: CatchesVerdict | null;
  /** null on a dangerous document. */
  clean: CleanVerdict | null;
  severity: SeverityVerdict;
  citations: CitationVerdict;
  /** Every gating measure this document failed, in words. Empty means pass. */
  failures: string[];
}

/**
 * Judge one document. `analysis` is what came back for it, from the live model
 * or from the reading recorded on disk.
 */
export function judge(entry: GoldEntry, analysis: Analysis): DocumentVerdict {
  const catches = entry.kind === "dangerous" ? judgeCatches(entry, analysis) : null;
  const clean = entry.kind === "clean" ? judgeClean(analysis) : null;
  const severity = measureSeverity(entry, analysis);
  const citations = checkCitations(entry, analysis);

  const failures: string[] = [];

  if (catches && !catches.passed) {
    for (const clauseType of catches.missing) {
      failures.push(
        `catches what matters: the Critical clause ${clauseType} was identified in this document and is not in the analysis`,
      );
    }
  }
  if (clean && !clean.passed) {
    for (const reason of clean.failures) failures.push(`clean document: ${reason}`);
  }
  if (!citations.passed) {
    for (const quote of citations.unlocatable) {
      failures.push(
        `citations: a flag cites a sentence that is not in the document: ${quote}`,
      );
    }
  }

  return {
    name: entry.name,
    provenance: entry.provenance,
    kind: entry.kind,
    catches,
    clean,
    severity,
    citations,
    failures,
  };
}

/**
 * PRD §4.2. Every Critical clause identified in advance has to appear in the
 * analysis. It is enough that it appears: whether it came back at the tier the
 * reviewer gave it is the severity measure's business, and that one does not
 * gate.
 */
function judgeCatches(entry: GoldEntry, analysis: Analysis): CatchesVerdict {
  const flagged = new Set(analysis.flags.map((f) => f.clauseType));
  const critical = entry.identified.filter((c) => c.severity === "Critical");
  const missing = critical
    .map((c) => c.clauseType)
    .filter((clauseType) => !flagged.has(clauseType));

  return {
    identified: critical.length,
    caught: critical.length - missing.length,
    missing,
    passed: missing.length === 0,
  };
}

/** PRD §4.4, spec D6. Three conditions, each reported on its own. */
function judgeClean(analysis: Analysis): CleanVerdict {
  const criticalFlags = analysis.flags.filter((f) => f.severity === "Critical").length;
  const flagCount = analysis.flags.length;
  const reasonable = saysItLooksReasonable(analysis.summary);

  const failures: string[] = [];
  if (criticalFlags > 0) {
    failures.push(
      `${criticalFlags} Critical flag${criticalFlags === 1 ? "" : "s"} on a document with nothing identified in it`,
    );
  }
  if (flagCount > CLEAN_MAX_FLAGS) {
    failures.push(
      `${flagCount} flags, and the threshold is at most ${CLEAN_MAX_FLAGS}`,
    );
  }
  if (!reasonable) {
    failures.push("the summary does not say the document looks reasonable");
  }

  return {
    criticalFlags,
    flagCount,
    saysItLooksReasonable: reasonable,
    failures,
    passed: failures.length === 0,
  };
}

/**
 * PRD §4.3, spec D9. Reported, never gating. The tier identified in advance
 * against the tier that came back, for every identified clause that was
 * flagged at all.
 */
function measureSeverity(entry: GoldEntry, analysis: Analysis): SeverityVerdict {
  const returned = new Map(analysis.flags.map((f) => [f.clauseType, f.severity]));

  let compared = 0;
  let agreed = 0;
  let notFlagged = 0;
  const disagreements: TierDisagreement[] = [];

  for (const clause of entry.identified) {
    const tier = returned.get(clause.clauseType);
    if (tier === undefined) {
      notFlagged += 1;
      continue;
    }
    compared += 1;
    if (tier === clause.severity) {
      agreed += 1;
      continue;
    }
    disagreements.push({
      clauseType: clause.clauseType,
      identified: clause.severity,
      returned: tier,
      tiers: Math.abs(rank(clause.severity) - rank(tier)),
    });
  }

  return {
    compared,
    agreed,
    notFlagged,
    disagreements,
    offByTwo: disagreements.filter((d) => d.tiers >= 2),
    agreement: compared === 0 ? null : agreed / compared,
  };
}

/** ADR 0001, checked again at the gate. */
function checkCitations(entry: GoldEntry, analysis: Analysis): CitationVerdict {
  const unlocatable = analysis.flags
    .filter((f) => locate(entry.documentText, f.sourceSentence) === null)
    .map((f) => `[${f.clauseType}] ${JSON.stringify(f.sourceSentence)}`);

  return {
    checked: analysis.flags.length,
    unlocatable,
    passed: unlocatable.length === 0,
  };
}

/**
 * The third condition of the clean-document gate. The analysis prompt tells
 * the model to say the document looks reasonable on the points checked when it
 * finds none of the red lines, so this looks for that in the words the reader
 * would see — and refuses it when the phrase is negated, because "it does not
 * look reasonable" is the opposite of what the gate is asking about.
 */
export function saysItLooksReasonable(summary: string): boolean {
  const text = ` ${summary.toLowerCase().replace(/\s+/g, " ")} `;

  for (const phrase of REASSURANCE) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(phrase, from);
      if (at === -1) break;
      const before = text.slice(Math.max(0, at - 32), at);
      if (!NEGATORS.some((n) => before.includes(n))) return true;
      from = at + phrase.length;
    }
  }
  return false;
}

/** The ways a summary says the document is fine. Small and deliberate. */
const REASSURANCE = [
  "looks reasonable",
  "look reasonable",
  "looks fair",
  "look fair",
  "appears reasonable",
  "appear reasonable",
  "reads as reasonable",
];

/** What turns any of those into its opposite. */
const NEGATORS = [
  " not ",
  "n't ",
  " never ",
  " hardly ",
  " far from ",
  " anything but ",
  " less than ",
];

function rank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

/** Did any gating measure fail on this document? */
export function failed(verdict: DocumentVerdict): boolean {
  return verdict.failures.length > 0;
}
