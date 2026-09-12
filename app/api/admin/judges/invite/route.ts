import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { requireAnyAdminRole, AuthError } from "@/lib/auth/require-admin";
import { inviteJudge, InviteError } from "@/lib/judges/invite";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    // Authorization check happens against the CALLER's own session (RLS-scoped
    // client) — only after this passes do we reach for the admin client, and
    // only for the one privileged operation (auth.admin.inviteUserByEmail)
    // that genuinely requires it.
    const { userId } = await requireAnyAdminRole(db);

    const body = await req.json();
    if (typeof body.judgeId !== "string" || typeof body.email !== "string") {
      return NextResponse.json({ error: "judgeId and email are required." }, { status: 400 });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const result = await inviteJudge(getAdminClient(), {
      judgeId: body.judgeId,
      email: body.email,
      invitedBy: userId,
      redirectTo: `${appBaseUrl}/login`,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof InviteError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("Judge invitation failed:", err);
    return NextResponse.json({ error: "Failed to send invitation." }, { status: 500 });
  }
}
