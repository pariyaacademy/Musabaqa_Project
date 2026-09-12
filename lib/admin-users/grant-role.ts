/**
 * lib/admin-users/grant-role.ts
 *
 * Spec section 8 (role-based access) doesn't specify a UI for granting
 * super_admin/competition_admin, but a super_admin needs SOME way to make
 * the first admins other than raw SQL. This is that path: invite by email
 * (new account) or attach the role to an existing account.
 *
 * ADMIN CLIENT REQUIRED — auth.admin.* calls bypass RLS. Caller must be
 * checked with requireSuperAdmin() BEFORE calling this; nothing here
 * re-checks authorization.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";

export class GrantRoleError extends Error {}

export type GrantableRole = "competition_admin" | "super_admin" | "judge";

export interface GrantRoleInput {
  email: string;
  role: GrantableRole;
  grantedBy: string;
  redirectTo?: string;
}

export async function findUserIdByEmail(adminDb: SupabaseClient, email: string): Promise<string | null> {
  // supabase-js's admin.listUsers() has no server-side email filter, so we
  // page through results client-side. Fine at the scale a competition
  // platform's admin roster actually reaches; would need revisiting if this
  // list grows into the thousands.
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 25; i++) {
    const { data, error } = await adminDb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null; // last page
    page++;
  }
  return null;
}

/** Finds an existing account by email, or invites a new one. Always returns a user id. */
export async function findOrInviteUserByEmail(
  adminDb: SupabaseClient,
  email: string,
  redirectTo?: string
): Promise<string> {
  const existing = await findUserIdByEmail(adminDb, email);
  if (existing) return existing;

  const { data: inviteData, error: inviteError } = await adminDb.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inviteError) throw new GrantRoleError(`Could not invite user: ${inviteError.message}`);
  return inviteData.user.id;
}

export async function grantRoleByEmail(adminDb: SupabaseClient, input: GrantRoleInput) {
  const userId = await findOrInviteUserByEmail(adminDb, input.email, input.redirectTo);

  const { error: roleError } = await adminDb
    .schema("musabaqa")
    .from("user_roles")
    .upsert({ user_id: userId, role: input.role }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;

  await writeAuditLog(adminDb, {
    userId: input.grantedBy,
    action: "role_grant",
    entityType: "user_roles",
    entityId: userId,
    newValue: { email: input.email, role: input.role },
  });

  return { userId, email: input.email, role: input.role };
}
