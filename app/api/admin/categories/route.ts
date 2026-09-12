import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    await requireSignedIn(db);
    const body = await req.json();

    if (typeof body.competitionId !== "string" || typeof body.categoryName !== "string") {
      return NextResponse.json({ error: "competitionId and categoryName are required." }, { status: 400 });
    }

    const { data, error } = await db
      .schema("musabaqa")
      .from("competition_categories")
      .insert({
        competition_id: body.competitionId,
        category_name: body.categoryName,
        start_juz: body.startJuz ?? null,
        end_juz: body.endJuz ?? null,
        duration_minutes: body.durationMinutes ?? null,
        number_of_questions: body.numberOfQuestions ?? 5,
        number_of_judges: body.numberOfJudges ?? 1,
        age_min: body.ageMin ?? null,
        age_max: body.ageMax ?? null,
        gender_restriction: body.genderRestriction ?? "ANY",
        aggregation_method: body.aggregationMethod ?? "AVERAGE_ALL",
        status: "ACTIVE",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ id: data.id });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Category creation failed:", err);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}
