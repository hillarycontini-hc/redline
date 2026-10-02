/**
 * The guard on the library, tested where the decision is actually made.
 *
 * The library is somebody's contracts. A signed-out request must not get one,
 * and "the link is not on the page" is not a guard — so the gate is asked
 * directly, with each of the three viewers, and what it returns is what the
 * route acts on.
 *
 * The `next` parameter is tested as hostile input, because it is: it arrives in
 * a URL anyone can write, and a sign-in page that forwards to wherever the
 * query string says is a sign-in page that sends readers to a stranger's copy
 * of itself.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  LIBRARY_PATH,
  READ_PATH,
  SIGN_IN_PATH,
  gateLibrary,
  onwardPath,
  signInPathFor,
} from "./access.ts";
import type { Viewer } from "./access.ts";

test("a signed-in viewer gets the library, and the account it may read", () => {
  const gate = gateLibrary({
    state: "signed-in",
    userId: "a2c1f0de-0000-4000-8000-000000000001",
    email: "freelancer@example.com",
  });

  assert.equal(gate.show, "library");
  if (gate.show !== "library") throw new Error("unreachable");
  assert.equal(gate.userId, "a2c1f0de-0000-4000-8000-000000000001");
});

test("a signed-out viewer never gets the library, and is sent to sign in", () => {
  const gate = gateLibrary({ state: "signed-out" });

  assert.notEqual(gate.show, "library");
  assert.equal(gate.show, "sign-in-first");
  if (gate.show !== "sign-in-first") throw new Error("unreachable");
  assert.ok(gate.goTo.startsWith(SIGN_IN_PATH));
});

test("the way out of the guard comes back to the library once signed in", () => {
  const gate = gateLibrary({ state: "signed-out" });
  if (gate.show !== "sign-in-first") throw new Error("unreachable");

  const next = new URLSearchParams(gate.goTo.split("?")[1]).get("next");
  assert.equal(next, LIBRARY_PATH);
});

test("a viewer with no account database behind it is told that, not sent to sign in", () => {
  const gate = gateLibrary({
    state: "no-accounts",
    missing: ["NEXT_PUBLIC_SUPABASE_URL"],
  });

  assert.equal(gate.show, "no-accounts");
  if (gate.show !== "no-accounts") throw new Error("unreachable");
  assert.deepEqual([...gate.missing], ["NEXT_PUBLIC_SUPABASE_URL"]);
});

test("no viewer state gets the library without an account id attached", () => {
  const viewers: Viewer[] = [
    { state: "signed-out" },
    { state: "no-accounts", missing: [] },
  ];

  for (const viewer of viewers) {
    const gate = gateLibrary(viewer);
    assert.notEqual(
      gate.show,
      "library",
      `${viewer.state} must not reach the library`,
    );
  }
});

test("a path on this site is honoured after signing in", () => {
  assert.equal(onwardPath(LIBRARY_PATH), LIBRARY_PATH);
  assert.equal(onwardPath("/library?from=head"), "/library?from=head");
});

test("a next that points off this site lands on the reading surface instead", () => {
  for (const hostile of [
    "//evil.example",
    "https://evil.example",
    "http://evil.example/library",
    "/\\evil.example",
    "/library\\..\\evil",
    "evil.example",
    "javascript:alert(1)",
    "",
    undefined,
    null,
  ]) {
    assert.equal(
      onwardPath(hostile),
      READ_PATH,
      `${JSON.stringify(hostile)} must not be followed`,
    );
  }
});

test("the sign-in link the guard builds carries a sanitised destination", () => {
  const path = signInPathFor("//evil.example");
  const next = new URLSearchParams(path.split("?")[1]).get("next");
  assert.equal(next, READ_PATH);
});
