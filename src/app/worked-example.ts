import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locate } from "@/lib/analysis/citation.ts";
import { SEED_RED_LINES, compareSeverity } from "@/lib/analysis/red-lines.ts";
import type { Severity } from "@/lib/analysis/types.ts";

/**
 * The worked example shown on the landing page, read from the gold set at
 * build time so the page can never drift from the fixture the citation check
 * runs against.
 *
 * ADR 0001 is enforced here as well as in the analysis module: an entry whose
 * source sentence cannot be located in the document is dropped, not rendered.
 * The landing page makes the same promise the product does, so it keeps it.
 */

export interface StatementEntry {
  clauseType: string;
  label: string;
  severity: Severity;
  consequence: string;
  sourceSentence: string;
  counterOffer?: string;
}

export interface WorkedExample {
  summary: string;
  entries: StatementEntry[];
  /** Entries the model produced whose sentence could not be located. */
  droppedCount: number;
}

interface RawFlag {
  clauseType: string;
  sourceSentence: string;
  consequence: string;
  counterOffer?: string;
}

const GOLD = join(process.cwd(), "gold-set", "sample-contractor-agreement");

export function readWorkedExample(): WorkedExample {
  const document = readFileSync(join(GOLD, "document.txt"), "utf8");
  const raw = JSON.parse(readFileSync(join(GOLD, "analysis.json"), "utf8")) as {
    summary: string;
    flags: RawFlag[];
  };

  const seeded = new Map(SEED_RED_LINES.map((r) => [r.clauseType, r]));
  const entries: StatementEntry[] = [];
  let droppedCount = 0;

  for (const flag of raw.flags) {
    const redLine = seeded.get(flag.clauseType);
    if (!redLine || locate(document, flag.sourceSentence) === null) {
      droppedCount += 1;
      continue;
    }
    entries.push({
      clauseType: flag.clauseType,
      label: redLine.label,
      severity: redLine.severity,
      consequence: flag.consequence,
      sourceSentence: flag.sourceSentence,
      counterOffer:
        redLine.severity === "Worth knowing" ? undefined : flag.counterOffer,
    });
  }

  entries.sort((a, b) => compareSeverity(a.severity, b.severity));
  return { summary: raw.summary, entries, droppedCount };
}
