import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { aggregateSession, computeCategoryRankings, publishResult, AggregationError } from "@/lib/scoring/aggregate";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();

    if (body.action === "aggregate" && typeof body.sessionId === "string") {
      const result = await aggregateSession(db, body.sessionId, userId);
      return NextResponse.json(result);
    }
    if (body.action === "rank" && typeof body.categoryId === "string") {
      const result = await computeCategoryRankings(db, body.categoryId, userId);
      return NextResponse.json(result);
    }
    if (body.action === "publish" && typeof body.resultId === "string") {
      const result = await publishResult(db, body.resultId, userId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Unknown or malformed action." }, { status: 400 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof AggregationError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("Results action failed:", err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
