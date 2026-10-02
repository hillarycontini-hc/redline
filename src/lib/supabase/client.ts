import { createServerClient } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseConfig, type SupabaseConfig } from "./config.ts";

/**
 * The one place a Supabase client is made. It takes the cookie jar it should
 * read the session out of, so the caller decides where cookies come from — a
 * render, an action, or the proxy — and this module does not have to know.
 *
 * It returns a result rather than a client. There is no second overload that
 * throws, and no non-null assertion anywhere above it: a deployment with no
 * Supabase configuration is a deployment Redline still works in, and the type
 * is what makes every caller say what it does about that.
 */

export type SupabaseAccess =
  | { configured: true; client: SupabaseClient }
  | { configured: false; missing: readonly string[] };

export function supabaseClient(
  cookies: CookieMethodsServer,
  config: SupabaseConfig = readSupabaseConfig(),
): SupabaseAccess {
  if (!config.configured) {
    return { configured: false, missing: config.missing };
  }

  return {
    configured: true,
    client: createServerClient(config.url, config.anonKey, { cookies }),
  };
}
