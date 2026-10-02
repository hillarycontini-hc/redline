/**
 * The gold set, read off disk.
 *
 * Every entry under gold-set/ carries a manifest.json saying where it came
 * from and what it is. Provenance is the point: PRD §4.5 asks for ten real
 * freelance agreements or leases with their dangerous clauses identified in
 * advance, plus five clean documents. A synthetic document tests the tool
 * against the imagination of whoever wrote it, so synthetic entries are
 * loaded, run, and counted separately — they never count toward the ten or
 * the five. See gold-set/README.md.
 *
 * An entry holds its document text either beside its manifest or, for the
 * two fixtures the unit suite already uses, in tests/fixtures/. A
 * fixture-backed entry is derived from the fixture at load time rather than
 * copied, so there is one copy of each document in the repo and the two
 * cannot drift apart.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseModelResponse } from "../analysis/analyze.ts";
import { SEVERITIES } from "../analysis/types.ts";
import type { ModelFlag, ModelResponse, Severity } from "../analysis/types.ts";

export type Provenance = "real" | "synthetic";

/** A dangerous document has clauses identified in advance. A clean one has none. */
export type Kind = "dangerous" | "clean";

/** PRD §4.5. The gold set v1 is this, and nothing less counts. */
export const TARGET_DANGEROUS = 10;
export const TARGET_CLEAN = 5;

/** One clause a reviewer identified in the document before Redline read it. */
export interface IdentifiedClause {
  clauseType: string;
  /** The tier the reviewer says it should earn. */
  severity: Severity;
}

/** gold-set/<name>/manifest.json, as written. */
export interface GoldManifest {
  provenance: Provenance;
  kind: Kind;
  /**
   * Set when the document lives in tests/fixtures/ rather than beside the
   * manifest: the sidecar's filename, e.g. "adhesion-contract.json". The
   * identified clauses and the recorded reading are both derived from it.
   */
  fixture?: string;
  /** Required unless `fixture` is set. Empty on a clean document. */
  identifiedClauses?: IdentifiedClause[];
  /** Why this document is in the set, and what it is and is not evidence of. */
  note?: string;
}

/** One planted clause in a tests/fixtures sidecar. */
export interface SidecarClause {
  clauseType: string;
  expectedSeverity: Severity;
  sourceSentence: string;
  consequence: string;
  /** null on Worth knowing, drafted replacement language otherwise. */
  counterOffer: string | null;
}

export interface Sidecar {
  filename: string;
  kind: Kind;
  summaryMustMention: string[];
  plantedClauses: SidecarClause[];
}

export interface GoldEntry {
  /** The directory name under gold-set/. */
  name: string;
  provenance: Provenance;
  kind: Kind;
  /** Where the document text was read from, relative to the repo root. */
  documentPath: string;
  documentText: string;
  /**
   * The reading recorded for this document: the model response shape, either
   * as the model gave it or as derived from a fixture sidecar. What `--dry`
   * runs the gates against, and what the citation check reads.
   */
  recorded: ModelResponse;
  /** What a reviewer identified in advance. Empty on a clean document. */
  identified: IdentifiedClause[];
  note?: string;
}

/** Paths are written with forward slashes so they read the same wherever the run happens. */
const FIXTURES = "tests/fixtures";

export function goldSetRoot(root: string = process.cwd()): string {
  return join(root, "gold-set");
}

/** Every entry under gold-set/, in directory order. */
export function listGoldSet(root: string = process.cwd()): GoldEntry[] {
  const dir = goldSetRoot(root);
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => readGoldEntry(name, root));
}

/**
 * Read one entry. Every problem with a manifest throws: a gold-set document
 * that does not say where it came from is worse than no document, because it
 * can be mistaken for evidence.
 */
export function readGoldEntry(
  name: string,
  root: string = process.cwd(),
): GoldEntry {
  const dir = join(goldSetRoot(root), name);
  const manifestPath = join(dir, "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error(
      `gold-set/${name} has no manifest.json, so nothing says whether it is a real document or a synthetic one. See gold-set/README.md.`,
    );
  }

  const manifest = parseManifest(name, readFileSync(manifestPath, "utf8"));

  const entry: GoldEntry = manifest.fixture
    ? fromFixture(name, manifest, manifest.fixture, root)
    : fromOwnFiles(name, manifest, dir, root);

  if (entry.kind === "clean" && entry.identified.length > 0) {
    throw new Error(
      `gold-set/${name} is marked clean but identifies ${entry.identified.length} clause(s). A clean document has nothing identified in it.`,
    );
  }
  if (entry.kind === "dangerous" && entry.identified.length === 0) {
    throw new Error(
      `gold-set/${name} is marked dangerous but identifies no clauses. The catches-what-matters gate would have nothing to check.`,
    );
  }

  return entry;
}

function fromOwnFiles(
  name: string,
  manifest: GoldManifest,
  dir: string,
  root: string,
): GoldEntry {
  if (manifest.identifiedClauses === undefined) {
    throw new Error(
      `gold-set/${name}/manifest.json has no identifiedClauses. Write [] on a clean document; a dangerous one needs the clauses a reviewer found.`,
    );
  }

  const documentPath = `gold-set/${name}/document.txt`;
  const entry: GoldEntry = {
    name,
    provenance: manifest.provenance,
    kind: manifest.kind,
    documentPath,
    documentText: readFileSync(join(root, documentPath), "utf8"),
    recorded: parseModelResponse(
      readFileSync(join(dir, "analysis.json"), "utf8"),
    ),
    identified: manifest.identifiedClauses,
  };
  if (manifest.note !== undefined) entry.note = manifest.note;
  return entry;
}

/**
 * Derive an entry from a tests/fixtures sidecar. The clauses identified in
 * advance are the clauses the fixture plants, and the recorded reading is the
 * payload a model that found all of them would return — the same payload the
 * unit suite stubs. Nothing is copied into gold-set/, so editing the fixture
 * edits the gold-set entry with it.
 */
function fromFixture(
  name: string,
  manifest: GoldManifest,
  sidecarName: string,
  root: string,
): GoldEntry {
  if (manifest.identifiedClauses !== undefined) {
    throw new Error(
      `gold-set/${name}/manifest.json sets both fixture and identifiedClauses. A fixture-backed entry takes its clauses from the sidecar, or the two drift apart.`,
    );
  }

  const sidecar = JSON.parse(
    readFileSync(join(root, FIXTURES, sidecarName), "utf8"),
  ) as Sidecar;

  if (sidecar.kind !== manifest.kind) {
    throw new Error(
      `gold-set/${name}/manifest.json says kind ${JSON.stringify(manifest.kind)}, ${FIXTURES}/${sidecarName} says ${JSON.stringify(sidecar.kind)}.`,
    );
  }

  const documentPath = `${FIXTURES}/${sidecar.filename}`;
  const entry: GoldEntry = {
    name,
    provenance: manifest.provenance,
    kind: manifest.kind,
    documentPath,
    documentText: readFileSync(join(root, documentPath), "utf8"),
    recorded: recordedFromSidecar(sidecar),
    identified: sidecar.plantedClauses.map((c) => ({
      clauseType: c.clauseType,
      severity: c.expectedSeverity,
    })),
  };
  if (manifest.note !== undefined) entry.note = manifest.note;
  return entry;
}

/** The reading a model that caught every planted clause would have returned. */
export function recordedFromSidecar(sidecar: Sidecar): ModelResponse {
  const flags: ModelFlag[] = sidecar.plantedClauses.map((c) => {
    const flag: ModelFlag = {
      clauseType: c.clauseType,
      sourceSentence: c.sourceSentence,
      consequence: c.consequence,
      confidence: "high",
    };
    if (c.counterOffer !== null) flag.counterOffer = c.counterOffer;
    return flag;
  });

  const points = sidecar.summaryMustMention.join("; ");
  const summary =
    sidecar.kind === "clean"
      ? `On the points checked, this document looks reasonable: ${points}.`
      : `What this document commits the signer to, on the points checked: ${points}.`;

  return { summary, flags };
}

export interface Coverage {
  realDangerous: number;
  realClean: number;
  syntheticDangerous: number;
  syntheticClean: number;
  targetDangerous: number;
  targetClean: number;
  /** How many real documents the set is still short of. */
  short: number;
  met: boolean;
}

/**
 * How much of the gold set PRD §4.5 asks for actually exists. Only real
 * documents count. Synthetic ones are counted, and reported, apart.
 */
export function coverage(entries: readonly GoldEntry[]): Coverage {
  const count = (p: Provenance, k: Kind) =>
    entries.filter((e) => e.provenance === p && e.kind === k).length;

  const realDangerous = count("real", "dangerous");
  const realClean = count("real", "clean");
  const short =
    Math.max(0, TARGET_DANGEROUS - realDangerous) +
    Math.max(0, TARGET_CLEAN - realClean);

  return {
    realDangerous,
    realClean,
    syntheticDangerous: count("synthetic", "dangerous"),
    syntheticClean: count("synthetic", "clean"),
    targetDangerous: TARGET_DANGEROUS,
    targetClean: TARGET_CLEAN,
    short,
    met: short === 0,
  };
}

/**
 * The one line the runner prints near the top of every run. A run against a
 * gold set of synthetic documents has to say so, or it reads as a pass.
 */
export function coverageLine(c: Coverage): string {
  const counts = `${c.realDangerous} of ${c.targetDangerous} dangerous, ${c.realClean} of ${c.targetClean} clean`;
  if (c.met) return `real documents   ${counts}. The gold set is complete.`;
  return `real documents   ${counts}. ${c.short} short of what a release needs (PRD 4.5).`;
}

function parseManifest(name: string, raw: string): GoldManifest {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `gold-set/${name}/manifest.json is not valid JSON: ${(error as Error).message}`,
    );
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(`gold-set/${name}/manifest.json is not an object`);
  }
  const m = data as Record<string, unknown>;

  if (m.provenance !== "real" && m.provenance !== "synthetic") {
    throw new Error(
      `gold-set/${name}/manifest.json needs provenance "real" or "synthetic", and has ${JSON.stringify(m.provenance ?? null)}. Only real documents count toward the gold set.`,
    );
  }
  if (m.kind !== "dangerous" && m.kind !== "clean") {
    throw new Error(
      `gold-set/${name}/manifest.json needs kind "dangerous" or "clean", and has ${JSON.stringify(m.kind ?? null)}.`,
    );
  }
  if (m.fixture !== undefined && typeof m.fixture !== "string") {
    throw new Error(`gold-set/${name}/manifest.json has a fixture that is not a filename`);
  }
  if (m.note !== undefined && typeof m.note !== "string") {
    throw new Error(`gold-set/${name}/manifest.json has a note that is not text`);
  }

  const manifest: GoldManifest = {
    provenance: m.provenance,
    kind: m.kind,
  };
  if (typeof m.fixture === "string") manifest.fixture = m.fixture;
  if (typeof m.note === "string") manifest.note = m.note;

  if (m.identifiedClauses !== undefined) {
    if (!Array.isArray(m.identifiedClauses)) {
      throw new Error(
        `gold-set/${name}/manifest.json has identifiedClauses that is not a list`,
      );
    }
    manifest.identifiedClauses = m.identifiedClauses.map((c, i) =>
      parseIdentified(name, i, c),
    );
  }

  return manifest;
}

function parseIdentified(
  name: string,
  index: number,
  value: unknown,
): IdentifiedClause {
  const where = `gold-set/${name}/manifest.json identifiedClauses[${index}]`;
  if (typeof value !== "object" || value === null) {
    throw new Error(`${where} is not an object`);
  }
  const c = value as Record<string, unknown>;
  if (typeof c.clauseType !== "string" || c.clauseType.length === 0) {
    throw new Error(`${where} has no clauseType`);
  }
  if (!isSeverity(c.severity)) {
    throw new Error(
      `${where} has severity ${JSON.stringify(c.severity ?? null)}, which is not one of ${SEVERITIES.join(", ")}`,
    );
  }
  return { clauseType: c.clauseType, severity: c.severity };
}

function isSeverity(x: unknown): x is Severity {
  return SEVERITIES.includes(x as Severity);
}
