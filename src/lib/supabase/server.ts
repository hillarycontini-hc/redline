import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Viewer } from "./access.ts";
import { supabaseClient, type SupabaseAccess } from "./client.ts";
import { readSupabaseConfig } from "./config.ts";

/**
 * Supabase as a render, an action, or a route handler sees it: a client reading
 * the session out of this request's cookies.
 *
 * `cookies()` is awaited. In Next 16 it is async, and every Supabase guide
 * written for 14 or 15 shows it synchronous.
 */

export async function supabaseForRequest(): Promise<SupabaseAccess> {
  const config = readSupabaseConfig();

  if (!config.configured) {
    return { configured: false, missing: config.missing };
  }

  const store = await cookies();

  return supabaseClient(
    {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // A page or a layout cannot write cookies, and a refresh that lands
          // during a render has nowhere to go. src/proxy.ts refreshes the
          // session on the way in, which is why this is survivable rather
          // than a lost session.
        }
      },
    },
    config,
  );
}

/** Who is asking, and the client that answered. One request, one of each. */
export interface Session {
  viewer: Viewer;
  access: SupabaseAccess;
}

/**
 * Who is asking. One of three answers, and the screens have words for each.
 *
 * The user is fetched rather than read off the session: a cookie can say
 * anything, and `getUser()` is the call that checks the token with Supabase
 * rather than believing what arrived.
 *
 * The client comes back alongside, because a screen that reads the account's
 * rows needs the same client that established who the account is — building a
 * second one would read the cookies twice to reach the same answer.
 */
export async function readSession(): Promise<Session> {
  // Whether accounts are switched on is a fact about the running deployment,
  // not about the build. Without this, a build with no Supabase configuration
  // would bake "there are no accounts set up here" into the account screens and
  // they would keep saying it after the configuration arrived — the stalest
  // kind of lie. Every screen that asks who is looking goes through here.
  await connection();

  const access = await supabaseForRequest();
  if (!access.configured) {
    return { viewer: { state: "no-accounts", missing: access.missing }, access };
  }

  const { data, error } = await access.client.auth.getUser();
  if (error || !data.user) return { viewer: { state: "signed-out" }, access };

  return {
    viewer: {
      state: "signed-in",
      userId: data.user.id,
      email: data.user.email ?? null,
    },
    access,
  };
}

export async function readViewer(): Promise<Viewer> {
  return (await readSession()).viewer;
}
