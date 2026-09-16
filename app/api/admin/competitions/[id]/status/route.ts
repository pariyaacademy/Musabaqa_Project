import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { writeAuditLog } from "@/lib/audit/log";

const VALID_STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "UPCOMING",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    // RLS (competitions_admin_update) enforces this admin actually manages this competition.
    const { data, error } = await db
      .schema("musabaqa")
      .from("competitions")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", params.id)
      .select("id, status")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 422 });

    await writeAuditLog(db, {
      userId,
      action: "competition_status_change",
      entityType: "competition",
      entityId: params.id,
      newValue: { status: body.status },
    });

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Status change failed:", err);
    return NextResponse.json({ error: "Failed to change status." }, { status: 500 });
  }
}
