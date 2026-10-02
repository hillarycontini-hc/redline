/**
 * Whether this deployment has accounts, read off the environment.
 *
 * The case that matters is the absent one, because it is the case the product
 * actually runs in: Redline reads a document with no Supabase configuration at
 * all, and the only thing that goes is the library and the reader's own red
 * lines. So "not configured" has to be an ordinary value a caller handles, not
 * an exception thrown on the way to a screen.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPABASE_ANON_KEY_VAR,
  SUPABASE_URL_VAR,
  readSupabaseConfig,
} from "./config.ts";

const URL = "https://project.supabase.co";
const KEY = "an-anon-key";

test("both variables set gives a configuration to use", () => {
  const config = readSupabaseConfig({
    [SUPABASE_URL_VAR]: URL,
    [SUPABASE_ANON_KEY_VAR]: KEY,
  });

  assert.equal(config.configured, true);
  if (!config.configured) throw new Error("unreachable");
  assert.equal(config.url, URL);
  assert.equal(config.anonKey, KEY);
});

test("neither variable set reports both as missing, and does not throw", () => {
  const config = readSupabaseConfig({});

  assert.equal(config.configured, false);
  if (config.configured) throw new Error("unreachable");
  assert.deepEqual([...config.missing].sort(), [
    SUPABASE_ANON_KEY_VAR,
    SUPABASE_URL_VAR,
  ]);
});

test("a URL with no key is not a configuration, and names the one that is missing", () => {
  const config = readSupabaseConfig({ [SUPABASE_URL_VAR]: URL });

  assert.equal(config.configured, false);
  if (config.configured) throw new Error("unreachable");
  assert.deepEqual([...config.missing], [SUPABASE_ANON_KEY_VAR]);
});

test("a key with no URL is not a configuration either", () => {
  const config = readSupabaseConfig({ [SUPABASE_ANON_KEY_VAR]: KEY });

  assert.equal(config.configured, false);
  if (config.configured) throw new Error("unreachable");
  assert.deepEqual([...config.missing], [SUPABASE_URL_VAR]);
});

test("a variable holding only whitespace counts as absent", () => {
  const config = readSupabaseConfig({
    [SUPABASE_URL_VAR]: "   ",
    [SUPABASE_ANON_KEY_VAR]: "\n",
  });

  assert.equal(config.configured, false);
  if (config.configured) throw new Error("unreachable");
  assert.equal(config.missing.length, 2);
});

test("surrounding whitespace is taken off a variable that is set", () => {
  const config = readSupabaseConfig({
    [SUPABASE_URL_VAR]: ` ${URL} `,
    [SUPABASE_ANON_KEY_VAR]: `${KEY}\n`,
  });

  assert.equal(config.configured, true);
  if (!config.configured) throw new Error("unreachable");
  assert.equal(config.url, URL);
  assert.equal(config.anonKey, KEY);
});
