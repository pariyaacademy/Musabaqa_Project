import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAnyAdminRole, AuthError } from "@/lib/auth/require-admin";
import { findOrInviteUserByEmail, GrantRoleError } from "@/lib/admin-users/grant-role";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServerClient();
  try {
    const { userId: actingUserId } = await requireAnyAdminRole(db);

    // Must already be an admin of THIS competition (or super_admin) to add
    // another one — requireAnyAdminRole only confirmed "an admin of something".
    const { data: adminRow } = await db
      .schema("musabaqa")
      .from("competition_admins")
      .select("user_id")
      .eq("competition_id", params.id)
      .eq("user_id", actingUserId)
      .maybeSingle();
    const { data: superAdminRow } = await db
      .schema("musabaqa")
      .from("user_roles")
      .select("role")
      .eq("user_id", actingUserId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!adminRow && !superAdminRow) {
      return NextResponse.json({ error: "You must already administer this competition." }, { status: 403 });
    }

    const body = await req.json();
    if (typeof body.email !== "string") {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const adminDb = getAdminClient();
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const newUserId = await findOrInviteUserByEmail(adminDb, body.email, `${appBaseUrl}/login`);

    const { error: linkError } = await adminDb.schema("musabaqa").from("competition_admins").upsert(
      { competition_id: params.id, user_id: newUserId },
      { onConflict: "competition_id,user_id" }
    );
    if (linkError) throw linkError;

    const { error: roleError } = await adminDb
      .schema("musabaqa")
      .from("user_roles")
      .upsert({ user_id: newUserId, role: "competition_admin" }, { onConflict: "user_id,role" });
    if (roleError) throw roleError;

    await writeAuditLog(adminDb, {
      userId: actingUserId,
      action: "competition_admin_added",
      entityType: "competition",
      entityId: params.id,
      newValue: { email: body.email, userId: newUserId },
    });

    return NextResponse.json({ userId: newUserId, email: body.email });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof GrantRoleError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("Adding competition admin failed:", err);
    return NextResponse.json({ error: "Failed to add admin." }, { status: 500 });
  }
}
