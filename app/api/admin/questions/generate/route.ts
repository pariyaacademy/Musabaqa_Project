import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { generateCategoryQuestions } from "@/lib/questions/generator";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();
    if (typeof body.categoryId !== "string" || typeof body.count !== "number") {
      return NextResponse.json({ error: "categoryId and count are required." }, { status: 400 });
    }

    const questions = await generateCategoryQuestions(db, body.categoryId, {
      count: body.count,
      minDistance: typeof body.minDistance === "number" ? body.minDistance : undefined,
      createdBy: userId,
    });

    return NextResponse.json({ generated: questions.length, questions });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Question generation failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to generate questions." }, { status: 422 });
  }
}
