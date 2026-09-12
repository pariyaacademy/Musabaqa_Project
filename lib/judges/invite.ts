/**
 * lib/judges/invite.ts
 *
 * Spec section 14: "invite judges". Sends a real Supabase Auth email
 * invite (the recipient gets an email with a link to set their password
 * and sign in), links the resulting account to the judges row, and grants
 * the 'judge' role in musabaqa.user_roles.
 *
 * Requires the ADMIN client (service role) because auth.admin.* calls
 * bypass RLS entirely — the caller's authorization must already have been
 * checked with requireAnyAdminRole() BEFORE calling this, since nothing
 * here re-checks it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";

export class InviteError extends Error {}

export interface InviteJudgeInput {
  judgeId: string;
  email: string;
  invitedBy: string;
  /** Where the invite email's link should redirect after the recipient sets a password. */
  redirectTo?: string;
}

export async function inviteJudge(adminDb: SupabaseClient, input: InviteJudgeInput) {
  const { data: judge, error: judgeError } = await adminDb
    .schema("musabaqa")
    .from("judges")
    .select("id, full_name, user_id")
    .eq("id", input.judgeId)
    .maybeSingle();
  if (judgeError) throw judgeError;
  if (!judge) throw new InviteError("Judge not found.");
  if (judge.user_id) throw new InviteError(`${judge.full_name} is already linked to an account.`);

  const { data: inviteData, error: inviteError } = await adminDb.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: input.redirectTo,
    data: { full_name: judge.full_name },
  });

  if (inviteError) {
    // A common case: the email already has an account (e.g. they're also a
    // school-system user). Surface a clear message rather than a raw error.
    throw new InviteError(`Could not send invite: ${inviteError.message}`);
  }
  const newUserId = inviteData.user.id;

  const { error: linkError } = await adminDb
    .schema("musabaqa")
    .from("judges")
    .update({ user_id: newUserId })
    .eq("id", input.judgeId);
  if (linkError) throw linkError;

  const { error: roleError } = await adminDb
    .schema("musabaqa")
    .from("user_roles")
    .upsert({ user_id: newUserId, role: "judge" }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;

  await writeAuditLog(adminDb, {
    userId: input.invitedBy,
    action: "judge_invitation",
    entityType: "judge",
    entityId: input.judgeId,
    newValue: { email: input.email, userId: newUserId },
  });

  return { userId: newUserId, email: input.email };
}
