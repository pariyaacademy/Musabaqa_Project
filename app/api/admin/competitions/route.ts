import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    // Only super_admin can create competitions (RLS: competitions_super_admin_write).
    // A competition_admin without that role gets a clean RLS rejection here.
    const { data: competition, error } = await db
      .schema("musabaqa")
      .from("competitions")
      .insert({
        name: body.name,
        description: body.description ?? null,
        venue: body.venue ?? null,
        city: body.city ?? null,
        country: body.country ?? null,
        start_date: body.startDate ?? null,
        end_date: body.endDate ?? null,
        registration_start: body.registrationStart ?? null,
        registration_end: body.registrationEnd ?? null,
        rules: body.rules ?? null,
        max_participants: body.maxParticipants ?? null,
        result_visibility: body.resultVisibility ?? "AFTER_COMPLETION",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    // Creator is automatically an admin of their own competition.
    await db.schema("musabaqa").from("competition_admins").insert({ competition_id: competition.id, user_id: userId });

    await writeAuditLog(db, {
      userId,
      action: "competition_creation",
      entityType: "competition",
      entityId: competition.id,
      newValue: { name: body.name },
    });

    return NextResponse.json({ id: competition.id });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Competition creation failed:", err);
    return NextResponse.json({ error: "Failed to create competition." }, { status: 500 });
  }
}
