/**
 * Redline does not do character recognition, and this is the assertion that
 * keeps it that way.
 *
 * ADR 0001: every flag cites a sentence the reader can find in their own copy.
 * Recognised text looks identical to read text once it is on screen, so a
 * citation into a misreading is worse than no citation — it is a claim the
 * reader has no way to check. Excluding it is a product decision, not a
 * question of effort, which is why it is tested rather than noted.
 *
 * Two things are checked, both against what is actually on disk: nothing in
 * the dependency tree is a recognition library, and nothing in `src/` reaches
 * for one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = process.cwd();
const SELF = relative(REPO, import.meta.filename).replaceAll("\\", "/");

/**
 * Names and phrases that only ever turn up where character recognition is
 * being used or added. `ocrad` is spelled out separately because a word
 * boundary will not find it inside its own name.
 */
const RECOGNITION = [
  /\bocr\b/i,
  /\bocrad\b/i,
  /tesseract/i,
  /optical character recognition/i,
  /text[-\s]?recognition/i,
];

function filesUnder(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...filesUnder(path));
      continue;
    }
    found.push(path);
  }
  return found;
}

test("no package in the dependency tree is a character-recognition library", () => {
  // The lockfile is the whole tree, direct and transitive, resolved. A
  // recognition library cannot be in the build without its name being in here.
  const lockfile = readFileSync(join(REPO, "pnpm-lock.yaml"), "utf8");
  const manifest = readFileSync(join(REPO, "package.json"), "utf8");

  for (const [source, contents] of [
    ["pnpm-lock.yaml", lockfile],
    ["package.json", manifest],
  ] as const) {
    const hits = contents
      .split("\n")
      .map((line, index) => ({ line: line.trim(), at: index + 1 }))
      .filter(({ line }) => RECOGNITION.some((pattern) => pattern.test(line)));

    assert.deepEqual(
      hits,
      [],
      `${source} names a character-recognition package:\n  ${hits
        .map((h) => `${h.at}: ${h.line}`)
        .join("\n  ")}`,
    );
  }
});

test("no file in src/ references character recognition or a path to it", () => {
  const offenders: string[] = [];

  for (const path of filesUnder(join(REPO, "src"))) {
    const name = relative(REPO, path).replaceAll("\\", "/");
    // This file names the thing it forbids, which is the only way to forbid it.
    if (name === SELF) continue;

    const contents = readFileSync(path, "utf8");
    for (const [index, line] of contents.split("\n").entries()) {
      if (RECOGNITION.some((pattern) => pattern.test(line))) {
        offenders.push(`${name}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `character recognition has got into the source:\n  ${offenders.join("\n  ")}`,
  );
});
