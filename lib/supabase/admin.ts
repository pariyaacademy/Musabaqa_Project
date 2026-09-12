/**
 * lib/supabase/admin.ts
 *
 * SERVER-ONLY. Uses the service role key, which bypasses RLS entirely.
 * Never import this file from a Client Component or expose it to the browser.
 *
 * Use this only for operations that legitimately need to bypass RLS in a
 * controlled way — e.g. the question generator (which must read the full
 * question bank server-side to pick from it, something no client role is
 * allowed to do directly per spec section 20), or admin-triggered batch jobs.
 *
 * Everywhere else, prefer lib/supabase/server.ts, which respects RLS for the
 * signed-in user and is the safer default.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. This client must only run server-side."
    );
  }

  // Defensive check: this module must never run in a browser bundle.
  if (typeof window !== "undefined") {
    throw new Error("getAdminClient() was called in a browser context. This is a critical security bug.");
  }

  _adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _adminClient;
}
