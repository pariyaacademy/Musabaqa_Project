import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { lockJudgeSubmission, ScoringError } from "@/lib/scoring/submit";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: judge } = await db.schema("musabaqa").from("judges").select("id").eq("user_id", user.id).maybeSingle();
  if (!judge) return NextResponse.json({ error: "No judge profile linked to this account." }, { status: 403 });

  const body = await req.json();
  if (typeof body.sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    const result = await lockJudgeSubmission(db, { sessionId: body.sessionId, judgeId: judge.id, lockedBy: user.id });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScoringError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Score locking failed:", err);
    return NextResponse.json({ error: "Failed to lock scores." }, { status: 500 });
  }
}
