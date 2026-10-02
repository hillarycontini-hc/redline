/**
 * The client factory, exercised for real. Nothing here stands in for the thing
 * under test: the factory runs, and what it hands back is used.
 *
 * Two behaviours are asserted. With no configuration the caller gets a value
 * saying so and naming what is absent — there is no client to use and no
 * exception to catch. With a configuration the caller gets a client that reads
 * the session out of the cookie jar it was handed, and reports nobody signed in
 * when that jar is empty. No network is touched either way: a client with no
 * session answers from the jar.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { supabaseClient } from "./client.ts";
import type { SupabaseConfig } from "./config.ts";

const CONFIGURED: SupabaseConfig = {
  configured: true,
  url: "https://project.supabase.co",
  anonKey: "an-anon-key",
};

const ABSENT = {
  configured: false,
  missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
} as const satisfies SupabaseConfig;

/** A cookie jar that records being read, so the wiring can be observed. */
function jar(cookies: { name: string; value: string }[] = []) {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    methods: {
      getAll: () => {
        reads += 1;
        return cookies;
      },
      setAll: () => {},
    },
  };
}

test("with no configuration the factory says so and names what is absent", () => {
  const cookies = jar();
  const access = supabaseClient(cookies.methods, ABSENT);

  assert.equal(access.configured, false);
  if (access.configured) throw new Error("unreachable");
  assert.deepEqual([...access.missing], [...ABSENT.missing]);
  assert.equal(
    cookies.reads,
    0,
    "no configuration means no session to go looking for",
  );
});

test("with a configuration the factory returns a client that reads the jar it was given", async () => {
  const cookies = jar();
  const access = supabaseClient(cookies.methods, CONFIGURED);

  assert.equal(access.configured, true);
  if (!access.configured) throw new Error("unreachable");

  const { data, error } = await access.client.auth.getUser();

  assert.equal(data.user, null, "an empty jar holds no session");
  assert.equal(error?.name, "AuthSessionMissingError");
  assert.ok(
    cookies.reads > 0,
    "the client has to have read the jar to know there was no session in it",
  );
});

test("a jar holding cookies that are not a session still yields nobody signed in", async () => {
  const cookies = jar([{ name: "something-else", value: "not-a-session" }]);
  const access = supabaseClient(cookies.methods, CONFIGURED);

  assert.equal(access.configured, true);
  if (!access.configured) throw new Error("unreachable");

  const { data } = await access.client.auth.getUser();
  assert.equal(data.user, null);
});
