import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { assignQuestionsToSession } from "@/lib/questions/generator";
import { detectSchedulingConflicts } from "@/lib/scheduling/conflicts";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();

    if (
      typeof body.competitionId !== "string" ||
      typeof body.categoryId !== "string" ||
      typeof body.participantId !== "string"
    ) {
      return NextResponse.json({ error: "competitionId, categoryId, and participantId are required." }, { status: 400 });
    }
    const judgeIds: string[] = Array.isArray(body.judgeIds) ? body.judgeIds : [];
    const scheduledTime: string | null = typeof body.scheduledTime === "string" ? body.scheduledTime : null;

    const { data: category } = await db
      .schema("musabaqa")
      .from("competition_categories")
      .select("number_of_questions, duration_minutes")
      .eq("id", body.categoryId)
      .single();

    const warnings = await detectSchedulingConflicts(db, {
      competitionId: body.competitionId,
      scheduledTime,
      durationMinutes: category?.duration_minutes ?? null,
      judgeIds,
      room: body.room ?? null,
    });

    const { data: session, error: sessionError } = await db
      .schema("musabaqa")
      .from("competition_sessions")
      .insert({
        competition_id: body.competitionId,
        category_id: body.categoryId,
        participant_id: body.participantId,
        room: body.room ?? null,
        scheduled_time: scheduledTime,
      })
      .select("id")
      .single();
    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 422 });

    if (judgeIds.length > 0) {
      const { error: judgeError } = await db
        .schema("musabaqa")
        .from("session_judges")
        .insert(judgeIds.map((judgeId, i) => ({ session_id: session.id, judge_id: judgeId, is_chairman: i === 0 })));
      if (judgeError) return NextResponse.json({ error: judgeError.message }, { status: 422 });
    }

    // Auto-assign questions from this category's ACTIVE pool, per the
    // category's configured question count. Uses the pool built by
    // generateCategoryQuestions() — never generates fresh ones here.
    const { data: pool, error: poolError } = await db
      .schema("musabaqa")
      .from("questions")
      .select("id")
      .eq("category_id", body.categoryId)
      .eq("status", "ACTIVE");
    if (poolError) return NextResponse.json({ error: poolError.message }, { status: 422 });

    const desiredCount = category?.number_of_questions ?? 5;
    const shuffled = [...(pool ?? [])].sort(() => Math.random() - 0.5).slice(0, desiredCount);

    if (shuffled.length > 0) {
      await assignQuestionsToSession(db, {
        sessionId: session.id,
        participantId: body.participantId,
        competitionId: body.competitionId,
        questionIds: shuffled.map((q) => q.id),
        assignedBy: userId,
      });
    }

    await writeAuditLog(db, {
      userId,
      action: "session_start",
      entityType: "competition_session",
      entityId: session.id,
      newValue: { participantId: body.participantId, questionsAssigned: shuffled.length, warnings },
    });

    return NextResponse.json({
      id: session.id,
      questionsAssigned: shuffled.length,
      poolSize: pool?.length ?? 0,
      warnings,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Session creation failed:", err);
    return NextResponse.json({ error: "Failed to create session." }, { status: 500 });
  }
}
