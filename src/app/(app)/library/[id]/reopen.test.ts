/**
 * Reopening a saved document makes no model call.
 *
 * Said as a structural fact rather than as an intention. The page that renders a
 * saved reading is read off disk, every module it imports is followed, and the
 * whole graph is checked for the OpenRouter caller and for the two modules that
 * use it. A reading taken out of the library has no path to the model at all, so
 * it cannot start calling one by accident later — which is exactly how that
 * would happen, since the thing it renders looks like the thing the live surface
 * renders after a call.
 *
 * The walk resolves only this project's own modules. A bare specifier is a
 * dependency or a framework import and is not followed, and none of those is the
 * model: the model is reached from src/lib/openrouter.ts and from nowhere else.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, posix, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "src");

const REOPEN_PAGE = resolve(SRC, "app/(app)/library/[id]/page.tsx");

/** The model, and the two modules that call it. None may be reachable. */
const THE_MODEL = [
  "lib/openrouter.ts",
  "lib/analysis/analyze.ts",
  "lib/analysis/question.ts",
];

/** Static imports, dynamic imports, and re-exports. */
const SPECIFIER =
  /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g;

/** A specifier this project owns, or nothing. */
function resolveOwn(specifier: string, fromFile: string): string | null {
  // A stylesheet is not a module graph edge worth following, and it cannot
  // import anything that calls a model.
  if (specifier.endsWith(".css")) return null;

  let candidate: string;
  if (specifier.startsWith("@/")) {
    candidate = resolve(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    candidate = resolve(dirname(fromFile), specifier);
  } else {
    // A bare specifier: react, next, @supabase, node:fs. Not ours.
    return null;
  }

  for (const path of [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    resolve(candidate, "index.ts"),
    resolve(candidate, "index.tsx"),
  ]) {
    if (existsSync(path) && !path.endsWith(".css")) return path;
  }

  return null;
}

/** Every module reachable from `entry`, as paths relative to src/. */
function moduleGraph(entry: string): { files: Set<string>; reachedBy: Map<string, string> } {
  const files = new Set<string>();
  const reachedBy = new Map<string, string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || files.has(file)) continue;
    files.add(file);

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(SPECIFIER)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) continue;

      const target = resolveOwn(specifier, file);
      if (!target || files.has(target)) continue;

      if (!reachedBy.has(target)) reachedBy.set(target, file);
      queue.push(target);
    }
  }

  return { files, reachedBy };
}

function asPosix(file: string): string {
  return relative(SRC, file).split("\\").join(posix.sep);
}

test("the page that renders a saved reading exists and is the one under test", () => {
  assert.ok(
    existsSync(REOPEN_PAGE),
    "the saved-reading page is not where this test expects it",
  );
});

test("nothing reachable from a reopened reading can call the model", () => {
  const { files, reachedBy } = moduleGraph(REOPEN_PAGE);

  const reached = [...files].map(asPosix);

  const offenders = THE_MODEL.filter((m) => reached.includes(m)).map((m) => {
    const full = resolve(SRC, m);
    const via = reachedBy.get(full);
    return `${m}, reached from ${via ? asPosix(via) : "the page itself"}`;
  });

  assert.deepEqual(
    offenders,
    [],
    `a reopened reading can reach the model:\n  ${offenders.join("\n  ")}`,
  );

  // The walk has to have actually walked, or the check above passes on nothing.
  assert.ok(
    reached.includes("lib/supabase/saved-reading.ts"),
    `the import walk did not reach the module that reads a saved reading; it found:\n  ${reached.join("\n  ")}`,
  );
  assert.ok(
    reached.includes("app/(app)/read/statement.tsx"),
    "the import walk did not reach the shared statement components",
  );
});

test("the live reading surface does reach the model, so the walk can tell them apart", () => {
  // The same walk from the route that analyses finds the caller. Without this,
  // a walk that silently resolved nothing would report the page clean.
  const { files } = moduleGraph(resolve(SRC, "app/api/analyze/route.ts"));
  const reached = [...files].map(asPosix);

  for (const m of THE_MODEL.filter((m) => m !== "lib/analysis/question.ts")) {
    assert.ok(
      reached.includes(m),
      `the import walk did not find ${m} from the route that analyses, so it cannot be trusted to find it anywhere`,
    );
  }
});
