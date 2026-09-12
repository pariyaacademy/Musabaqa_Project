/**
 * lib/scoring/submit.ts
 *
 * Spec sections 24-27. A judge scores one criterion at a time during the
 * oral examination; submitJudgeScore() upserts THEIR OWN row only (RLS
 * already enforces this — see judgescores_own_update_unlocked policy — this
 * function just gives the app a clean entry point). Nothing here can ever
 * touch another judge's row, by construction: the upsert key includes
 * judge_id, and RLS additionally checks judges.user_id = auth.uid().
 *
 * Locking (section 27) is a deliberate separate step from submitting: a
 * judge can revise their scores freely up until they explicitly lock the
 * session, at which point RLS's `locked = false` clause blocks further
 * writes from anyone except the authorized correction workflow.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";

export class ScoringError extends Error {}

export interface SubmitScoreInput {
  sessionId: string;
  judgeId: string;
  criterionId: string;
  rawScore: number;
  deductions?: number;
  comments?: string;
  submittedBy: string; // auth.users.id, for audit
}

export async function submitJudgeScore(db: SupabaseClient, input: SubmitScoreInput) {
  const { data: criterion, error: criterionError } = await db
    .schema("musabaqa")
    .from("score_criteria")
    .select("id, max_score")
    .eq("id", input.criterionId)
    .single();
  if (criterionError) throw criterionError;

  if (input.rawScore < 0 || input.rawScore > criterion.max_score) {
    throw new ScoringError(`raw_score must be between 0 and ${criterion.max_score} for this criterion.`);
  }
  const deductions = input.deductions ?? 0;
  if (deductions < 0) throw new ScoringError("deductions cannot be negative — use raw_score for the base value.");

  const { data, error } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .upsert(
      {
        session_id: input.sessionId,
        judge_id: input.judgeId,
        criterion_id: input.criterionId,
        raw_score: input.rawScore,
        deductions,
        comments: input.comments ?? null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "session_id,judge_id,criterion_id" }
    )
    .select("id, final_score, locked")
    .single();

  if (error) throw error;

  await writeAuditLog(db, {
    userId: input.submittedBy,
    action: "score_submission",
    entityType: "judge_score",
    entityId: data.id,
    newValue: { rawScore: input.rawScore, deductions, finalScore: data.final_score },
  });

  return data;
}

/**
 * Locks all of a judge's scores for a session — no further edits possible
 * except through the authorized correction workflow (section 28). Also
 * flips the session to SUBMITTED once every assigned judge has locked.
 */
export async function lockJudgeSubmission(
  db: SupabaseClient,
  input: { sessionId: string; judgeId: string; lockedBy: string }
) {
  const { data: scores, error: scoresError } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .select("id")
    .eq("session_id", input.sessionId)
    .eq("judge_id", input.judgeId);
  if (scoresError) throw scoresError;
  if (!scores || scores.length === 0) {
    throw new ScoringError("This judge has not submitted any scores for this session yet.");
  }

  const { error: lockError } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .update({ locked: true })
    .eq("session_id", input.sessionId)
    .eq("judge_id", input.judgeId);
  if (lockError) throw lockError;

  await writeAuditLog(db, {
    userId: input.lockedBy,
    action: "score_locking",
    entityType: "competition_session",
    entityId: input.sessionId,
    newValue: { judgeId: input.judgeId },
  });

  // If every assigned judge for this session has now locked, advance the session.
  const { data: assignedJudges, error: assignedError } = await db
    .schema("musabaqa")
    .from("session_judges")
    .select("judge_id")
    .eq("session_id", input.sessionId);
  if (assignedError) throw assignedError;

  const { data: lockedRows, error: lockedError } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .select("judge_id, locked")
    .eq("session_id", input.sessionId);
  if (lockedError) throw lockedError;

  const lockedJudgeIds = new Set(
    (lockedRows ?? []).filter((r) => r.locked).map((r) => r.judge_id)
  );
  const allLocked = (assignedJudges ?? []).every((j) => lockedJudgeIds.has(j.judge_id));

  if (allLocked && assignedJudges && assignedJudges.length > 0) {
    const { error: sessionUpdateError } = await db
      .schema("musabaqa")
      .from("competition_sessions")
      .update({ status: "SUBMITTED" })
      .eq("id", input.sessionId);
    if (sessionUpdateError) throw sessionUpdateError;
  }

  return { allJudgesLocked: allLocked };
}
