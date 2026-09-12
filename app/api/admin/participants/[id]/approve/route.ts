import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();
    if (body.decision !== "APPROVED" && body.decision !== "REJECTED") {
      return NextResponse.json({ error: "decision must be APPROVED or REJECTED." }, { status: 400 });
    }

    // RLS (participants_admin_update_via_competition) enforces this admin
    // actually manages a competition this participant is registered in.
    const { data, error } = await db
      .schema("musabaqa")
      .from("participants")
      .update({ status: body.decision })
      .eq("id", params.id)
      .select("id, participant_code")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 422 });

    await writeAuditLog(db, {
      userId,
      action: "participant_modification",
      entityType: "participant",
      entityId: params.id,
      newValue: { status: body.decision },
    });

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Participant approval failed:", err);
    return NextResponse.json({ error: "Failed to update participant." }, { status: 500 });
  }
}
