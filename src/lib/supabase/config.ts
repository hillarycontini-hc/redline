/**
 * Whether this deployment has an account database behind it, and what to do
 * when it does not.
 *
 * Redline runs without one. Reading a document needs no account — the file is
 * parsed in the browser and the text goes straight to the analysis — so a
 * missing Supabase configuration costs the reader the library and their own
 * red lines, and nothing else. Every caller gets that back as a value it has to
 * handle, which is why there is no throw here and no default URL.
 *
 * No module in the product fills these in, fakes them, or works round them
 * being absent.
 */

export const SUPABASE_URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_ANON_KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

export type SupabaseConfig =
  | { configured: true; url: string; anonKey: string }
  | { configured: false; missing: readonly string[] };

/** What the environment has to offer. Read once per call, never cached. */
export interface SupabaseEnv {
  [key: string]: string | undefined;
}

/**
 * Both variables, or neither. Half a configuration is not a configuration: a
 * URL without a key would get as far as a request and fail there, which is a
 * worse way to find out.
 */
export function readSupabaseConfig(
  env: SupabaseEnv = process.env,
): SupabaseConfig {
  const url = env[SUPABASE_URL_VAR]?.trim();
  const anonKey = env[SUPABASE_ANON_KEY_VAR]?.trim();

  const missing: string[] = [];
  if (!url) missing.push(SUPABASE_URL_VAR);
  if (!anonKey) missing.push(SUPABASE_ANON_KEY_VAR);

  if (!url || !anonKey) return { configured: false, missing };
  return { configured: true, url, anonKey };
}
