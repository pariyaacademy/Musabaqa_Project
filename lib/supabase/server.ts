/**
 * lib/supabase/server.ts
 *
 * SERVER-ONLY. Builds a Supabase client scoped to the current signed-in
 * user's session (via their auth cookie), so every query goes through RLS
 * exactly as if the user made it directly. This is the DEFAULT client for
 * Server Components, Server Actions, and Route Handlers — reach for
 * lib/supabase/admin.ts only when you specifically need to bypass RLS for
 * a documented reason (e.g. anonymous public registration).
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getServerClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        // Server Components can't set cookies (only Route Handlers/Server
        // Actions can) — Supabase's own recommended pattern is to swallow
        // this and rely on middleware.ts to keep the session refreshed.
        try {
          cookieStore.set(name, value, options);
        } catch {
          /* called from a Server Component — safe to ignore, see above */
        }
      },
      remove: (name: string, options: CookieOptions) => {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch {
          /* see note above */
        }
      },
    },
  });
}
