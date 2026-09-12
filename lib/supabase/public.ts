/**
 * lib/supabase/public.ts
 *
 * For read-only public data (competition listings, scoreboards, certificate
 * verification) where there's no signed-in user to scope a session to.
 * Uses the anon key — RLS's public-read policies are what actually protect
 * this, not obscurity. Safe to import from both Server and Client Components.
 */
import { createClient } from "@supabase/supabase-js";

export function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.");
  }
  return createClient(url, anonKey);
}
