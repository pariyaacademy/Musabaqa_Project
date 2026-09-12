import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    await requireSignedIn(db);
    const body = await req.json();
    if (typeof body.categoryId !== "string" || typeof body.criterionName !== "string" || typeof body.maxScore !== "number") {
      return NextResponse.json({ error: "categoryId, criterionName, and maxScore are required." }, { status: 400 });
    }

    const { data, error } = await db
      .schema("musabaqa")
      .from("score_criteria")
      .insert({
        category_id: body.categoryId,
        criterion_name: body.criterionName,
        max_score: body.maxScore,
        weight: typeof body.weight === "number" ? body.weight : 1,
        display_order: typeof body.displayOrder === "number" ? body.displayOrder : 0,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Criterion creation failed:", err);
    return NextResponse.json({ error: "Failed to create criterion." }, { status: 500 });
  }
}
