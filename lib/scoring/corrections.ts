/**
 * lib/scoring/corrections.ts
 *
 * Spec section 28. This is the ONLY sanctioned way to change a judge_score
 * after it's locked. RLS restricts writes to musabaqa.judge_scores to the
 * owning judge (while unlocked) or an admin of the competition (via the
 * judgescores_admin_all policy) — so this function relies on that same RLS
 * to keep it admin-only, and layers the audit trail on top.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";

export class CorrectionError extends Error {}

export interface CorrectScoreInput {
  judgeScoreId: string;
  correctedRawScore: number;
  correctedDeductions?: number;
  reason: string;
  correctedBy: string; // auth.users.id of the admin making the correction
}

export async function correctJudgeScore(db: SupabaseClient, input: CorrectScoreInput) {
  if (!input.reason?.trim()) {
    throw new CorrectionError("A reason is required for every score correction.");
  }

  const { data: existing, error: fetchError } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .select("id, final_score, raw_score, deductions, criterion_id")
    .eq("id", input.judgeScoreId)
    .single();
  if (fetchError) throw fetchError;

  const { data: criterion, error: criterionError } = await db
    .schema("musabaqa")
    .from("score_criteria")
    .select("max_score")
    .eq("id", existing.criterion_id)
    .single();
  if (criterionError) throw criterionError;

  if (input.correctedRawScore < 0 || input.correctedRawScore > criterion.max_score) {
    throw new CorrectionError(`corrected score must be between 0 and ${criterion.max_score}.`);
  }

  const deductions = input.correctedDeductions ?? existing.deductions;
  const newFinalScore = input.correctedRawScore - deductions;

  // Record the correction BEFORE applying it — original_score/corrected_score
  // preserve the full history regardless of what happens next.
  const { error: correctionError } = await db.schema("musabaqa").from("score_corrections").insert({
    judge_score_id: input.judgeScoreId,
    original_score: existing.final_score,
    corrected_score: newFinalScore,
    corrected_by: input.correctedBy,
    reason: input.reason.trim(),
  });
  if (correctionError) throw correctionError;

  const { data: updated, error: updateError } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .update({ raw_score: input.correctedRawScore, deductions })
    .eq("id", input.judgeScoreId)
    .select("id, final_score, locked")
    .single();
  if (updateError) throw updateError;

  await writeAuditLog(db, {
    userId: input.correctedBy,
    action: "admin_correction",
    entityType: "judge_score",
    entityId: input.judgeScoreId,
    oldValue: { finalScore: existing.final_score },
    newValue: { finalScore: updated.final_score, reason: input.reason },
  });

  return updated;
}
