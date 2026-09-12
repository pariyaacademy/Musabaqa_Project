/**
 * lib/auth/require-admin.ts
 *
 * Small helper so every /api/admin/* route doesn't repeat the same
 * "get user, check they're signed in" boilerplate. This is a convenience
 * check, NOT the security boundary — every query these routes make still
 * goes through the RLS-scoped server client, which is what actually
 * enforces "admin of THIS competition" on a per-row basis via
 * musabaqa.is_admin_of_competition(). A route that forgot to call this
 * would still be safe; it would just get empty results / RLS errors
 * instead of a clean 401.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireSignedIn(db: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new AuthError("Not signed in.", 401);
  return user.id;
}

/**
 * Checks the caller holds 'competition_admin' or 'super_admin' in
 * musabaqa.user_roles. Uses the RLS-scoped server client — the
 * user_roles_self_read policy lets anyone read their own role rows, so
 * this works without needing the admin client.
 */
export async function requireAnyAdminRole(db: SupabaseClient): Promise<{ userId: string; isSuperAdmin: boolean }> {
  const userId = await requireSignedIn(db);
  const { data: roles, error } = await db.schema("musabaqa").from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  const roleNames = (roles ?? []).map((r) => r.role);
  if (!roleNames.includes("competition_admin") && !roleNames.includes("super_admin")) {
    throw new AuthError("This action requires a competition admin or super admin role.", 403);
  }
  return { userId, isSuperAdmin: roleNames.includes("super_admin") };
}

/** Stricter check for actions that must stay super_admin-only (e.g. granting roles). */
export async function requireSuperAdmin(db: SupabaseClient): Promise<string> {
  const userId = await requireSignedIn(db);
  const { data: roles, error } = await db.schema("musabaqa").from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin");
  if (error) throw error;
  if (!roles || roles.length === 0) {
    throw new AuthError("This action requires the super_admin role.", 403);
  }
  return userId;
}
