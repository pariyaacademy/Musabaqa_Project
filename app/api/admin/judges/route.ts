import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireAnyAdminRole, AuthError } from "@/lib/auth/require-admin";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const { userId } = await requireAnyAdminRole(db);
    const body = await req.json();

    if (typeof body.fullName !== "string" || !body.fullName.trim()) {
      return NextResponse.json({ error: "fullName is required." }, { status: 400 });
    }

    const { data: judge, error } = await db
      .schema("musabaqa")
      .from("judges")
      .insert({
        full_name: body.fullName.trim(),
        phone: typeof body.phone === "string" ? body.phone : null,
        email: typeof body.email === "string" ? body.email : null,
        specialization: typeof body.specialization === "string" ? body.specialization : null,
      })
      .select("id, full_name")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 422 });

    await writeAuditLog(db, {
      userId,
      action: "judge_creation",
      entityType: "judge",
      entityId: judge.id,
      newValue: { fullName: judge.full_name },
    });

    return NextResponse.json(judge);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Judge creation failed:", err);
    return NextResponse.json({ error: "Failed to create judge." }, { status: 500 });
  }
}
