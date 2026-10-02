import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSupabaseConfig } from "@/lib/supabase/config.ts";

/**
 * Keeps a signed-in session alive across a reload.
 *
 * An access token expires after an hour. The refreshed one has to be written
 * back as a cookie, and a page or a layout cannot write cookies — so if this
 * did not run, a reader would be signed out mid-document and told nothing about
 * why. Asking for the user is what performs the refresh; the cookies it hands
 * back go onto the response.
 *
 * This is `proxy.ts`, not `middleware.ts`. The file convention was renamed in
 * Next 16 and the export is `proxy`. Every Supabase-with-Next.js guide in
 * circulation says `middleware`; they are written for 14 and 15.
 *
 * It runs apart from the render and may be served from a CDN, so it holds no
 * module state: the configuration is read and the client is built per request.
 *
 * With no Supabase configuration it does nothing at all, and the app is exactly
 * the app it was before accounts existed.
 */
export async function proxy(request: NextRequest) {
  const settings = readSupabaseConfig();
  if (!settings.configured) return NextResponse.next();

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(settings.url, settings.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        // The refreshed tokens go two ways: onto the request, so the render
        // that follows in this same pass sees the new session, and onto the
        // response, so the browser keeps it.
        for (const { name, value } of toSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: request.headers } });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
        // A response carrying a session cookie must never be cached, or one
        // reader's token is handed to the next. The library supplies the
        // headers that say so.
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything a person looks at, and nothing else. The API routes are left
    // out: the analysis and the question box take a document's text and need no
    // session, so nothing is gained by putting a Supabase call in front of
    // them. Static files and images are left out because a matcher without
    // them runs auth logic in front of the stylesheet.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
