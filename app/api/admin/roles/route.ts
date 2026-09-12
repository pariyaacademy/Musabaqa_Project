import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import { grantRoleByEmail, GrantRoleError, type GrantableRole } from "@/lib/admin-users/grant-role";

const VALID_ROLES: GrantableRole[] = ["competition_admin", "super_admin", "judge"];

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const grantedBy = await requireSuperAdmin(db);

    const body = await req.json();
    if (typeof body.email !== "string" || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: `email and role (one of ${VALID_ROLES.join(", ")}) are required.` }, { status: 400 });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const result = await grantRoleByEmail(getAdminClient(), {
      email: body.email,
      role: body.role,
      grantedBy,
      redirectTo: `${appBaseUrl}/login`,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof GrantRoleError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("Role grant failed:", err);
    return NextResponse.json({ error: "Failed to grant role." }, { status: 500 });
  }
}
