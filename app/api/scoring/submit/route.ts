import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { submitJudgeScore, ScoringError } from "@/lib/scoring/submit";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: judge } = await db.schema("musabaqa").from("judges").select("id").eq("user_id", user.id).maybeSingle();
  if (!judge) return NextResponse.json({ error: "No judge profile linked to this account." }, { status: 403 });

  const body = await req.json();
  if (
    typeof body.sessionId !== "string" ||
    typeof body.criterionId !== "string" ||
    typeof body.rawScore !== "number"
  ) {
    return NextResponse.json({ error: "sessionId, criterionId, and rawScore are required." }, { status: 400 });
  }

  try {
    const result = await submitJudgeScore(db, {
      sessionId: body.sessionId,
      judgeId: judge.id,
      criterionId: body.criterionId,
      rawScore: body.rawScore,
      deductions: typeof body.deductions === "number" ? body.deductions : 0,
      comments: typeof body.comments === "string" ? body.comments : undefined,
      submittedBy: user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScoringError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Score submission failed:", err);
    return NextResponse.json({ error: "Failed to submit score." }, { status: 500 });
  }
}
