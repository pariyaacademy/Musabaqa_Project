/**
 * lib/supabase/browser.ts
 *
 * CLIENT-ONLY. For Client Components — the login form, sign-out button,
 * etc. Uses @supabase/ssr's browser client so the session is stored in
 * cookies (not localStorage), matching what lib/supabase/server.ts and
 * middleware.ts read on the server side.
 */
import { createBrowserClient } from "@supabase/ssr";

export function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createBrowserClient(url, anonKey);
}
