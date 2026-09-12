/**
 * lib/scoring/aggregate.ts
 *
 * Spec sections 26 (aggregation) and 31 (final results / ranking).
 *
 * Two-stage process, deliberately kept separate:
 *  1. aggregateSession() — turns one participant's locked judge scores into
 *     one final_score for that session, using the category's configured
 *     aggregation_method. Writes a DRAFT (unpublished) results row.
 *  2. computeCategoryRankings() — once all sessions in a category are
 *     aggregated, ranks them and assigns `position`. Still unpublished —
 *     publishing is a separate, explicit admin action (section 31: "Admin
 *     publishes result"), never automatic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";

export class AggregationError extends Error {}

type AggregationMethod =
  | "AVERAGE_ALL"
  | "DROP_LOWEST"
  | "DROP_HIGHEST_AND_LOWEST"
  | "WEIGHTED_AVERAGE"
  | "CHAIRMAN_OVERRIDE";

interface JudgeTotal {
  judgeId: string;
  total: number;
  weight: number;
  isChairman: boolean;
}

/** Pure function, unit-testable without a DB: applies the method to a list of per-judge totals. */
export function applyAggregationMethod(method: AggregationMethod, judgeTotals: JudgeTotal[]): number {
  if (judgeTotals.length === 0) {
    throw new AggregationError("No judge scores to aggregate.");
  }

  switch (method) {
    case "AVERAGE_ALL":
      return judgeTotals.reduce((sum, j) => sum + j.total, 0) / judgeTotals.length;

    case "DROP_LOWEST": {
      if (judgeTotals.length < 2) return judgeTotals[0].total;
      const sorted = [...judgeTotals].sort((a, b) => a.total - b.total);
      const rest = sorted.slice(1);
      return rest.reduce((sum, j) => sum + j.total, 0) / rest.length;
    }

    case "DROP_HIGHEST_AND_LOWEST": {
      if (judgeTotals.length < 3) {
        // Not enough judges for this method to make sense — fall back to average
        // rather than silently dropping a judge's only-available score.
        return judgeTotals.reduce((sum, j) => sum + j.total, 0) / judgeTotals.length;
      }
      const sorted = [...judgeTotals].sort((a, b) => a.total - b.total);
      const middle = sorted.slice(1, -1);
      return middle.reduce((sum, j) => sum + j.total, 0) / middle.length;
    }

    case "WEIGHTED_AVERAGE": {
      const totalWeight = judgeTotals.reduce((sum, j) => sum + j.weight, 0);
      if (totalWeight === 0) throw new AggregationError("Total judge weight is zero.");
      return judgeTotals.reduce((sum, j) => sum + j.total * j.weight, 0) / totalWeight;
    }

    case "CHAIRMAN_OVERRIDE": {
      const chairman = judgeTotals.find((j) => j.isChairman);
      if (chairman) return chairman.total;
      // No chairman designated — fall back to average rather than failing outright.
      return judgeTotals.reduce((sum, j) => sum + j.total, 0) / judgeTotals.length;
    }

    default: {
      const _exhaustive: never = method;
      throw new AggregationError(`Unknown aggregation method: ${_exhaustive}`);
    }
  }
}

/**
 * Aggregates one session's locked judge scores into a draft result.
 * Requires every assigned judge to have locked their scores first — this
 * is what "session.status === 'SUBMITTED'" (set by lockJudgeSubmission)
 * signals; this function re-checks it rather than trusting the caller.
 */
export async function aggregateSession(db: SupabaseClient, sessionId: string, aggregatedBy: string) {
  const { data: session, error: sessionError } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select("id, status, competition_id, category_id, participant_id")
    .eq("id", sessionId)
    .single();
  if (sessionError) throw sessionError;

  if (session.status !== "SUBMITTED") {
    throw new AggregationError(
      `Session is in status ${session.status}, not SUBMITTED. All assigned judges must lock their scores before aggregation.`
    );
  }

  const { data: category, error: categoryError } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("aggregation_method")
    .eq("id", session.category_id)
    .single();
  if (categoryError) throw categoryError;

  const { data: criteria, error: criteriaError } = await db
    .schema("musabaqa")
    .from("score_criteria")
    .select("id, weight")
    .eq("category_id", session.category_id);
  if (criteriaError) throw criteriaError;
  const criterionWeight = new Map((criteria ?? []).map((c) => [c.id, c.weight as number]));

  const { data: scores, error: scoresError } = await db
    .schema("musabaqa")
    .from("judge_scores")
    .select("judge_id, criterion_id, final_score, locked")
    .eq("session_id", sessionId);
  if (scoresError) throw scoresError;
  if (!scores || scores.length === 0) throw new AggregationError("No judge scores found for this session.");
  if (scores.some((s) => !s.locked)) {
    throw new AggregationError("Not all scores for this session are locked yet.");
  }

  const { data: sessionJudges, error: sjError } = await db
    .schema("musabaqa")
    .from("session_judges")
    .select("judge_id, weight, is_chairman")
    .eq("session_id", sessionId);
  if (sjError) throw sjError;

  const byJudge = new Map<string, { weight: number; isChairman: boolean }>(
    (sessionJudges ?? []).map((j) => [j.judge_id, { weight: j.weight, isChairman: j.is_chairman }])
  );

  const totalsByJudge = new Map<string, number>();
  for (const s of scores) {
    const w = criterionWeight.get(s.criterion_id) ?? 1;
    totalsByJudge.set(s.judge_id, (totalsByJudge.get(s.judge_id) ?? 0) + s.final_score * w);
  }

  const judgeTotals: JudgeTotal[] = [...totalsByJudge.entries()].map(([judgeId, total]) => ({
    judgeId,
    total,
    weight: byJudge.get(judgeId)?.weight ?? 1,
    isChairman: byJudge.get(judgeId)?.isChairman ?? false,
  }));

  const finalScore = applyAggregationMethod(category.aggregation_method as AggregationMethod, judgeTotals);

  const { data: result, error: resultError } = await db
    .schema("musabaqa")
    .from("results")
    .upsert(
      {
        competition_id: session.competition_id,
        category_id: session.category_id,
        participant_id: session.participant_id,
        session_id: sessionId,
        final_score: finalScore,
        published: false,
      },
      { onConflict: "competition_id,category_id,participant_id" }
    )
    .select("id, final_score")
    .single();
  if (resultError) throw resultError;

  const { error: sessionUpdateError } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .update({ status: "SCORED" })
    .eq("id", sessionId);
  if (sessionUpdateError) throw sessionUpdateError;

  await writeAuditLog(db, {
    userId: aggregatedBy,
    action: "score_aggregation",
    entityType: "competition_session",
    entityId: sessionId,
    newValue: { method: category.aggregation_method, finalScore, judgeCount: judgeTotals.length },
  });

  return result;
}

/**
 * Ranks all (aggregated) results within a category using standard
 * competition ranking ("1224" — ties share a position, the next position
 * skips accordingly). Assigns a default award label by position, which
 * admins can still override manually afterward. Does NOT publish —
 * publishing is a separate explicit step.
 */
export async function computeCategoryRankings(db: SupabaseClient, categoryId: string, rankedBy: string) {
  const { data: results, error } = await db
    .schema("musabaqa")
    .from("results")
    .select("id, final_score")
    .eq("category_id", categoryId)
    .not("final_score", "is", null)
    .order("final_score", { ascending: false });
  if (error) throw error;
  if (!results || results.length === 0) {
    throw new AggregationError("No aggregated results found for this category yet.");
  }

  let currentPosition = 0;
  let previousScore: number | null = null;
  let rankedCount = 0;

  for (const row of results) {
    rankedCount++;
    if (row.final_score !== previousScore) {
      currentPosition = rankedCount;
      previousScore = row.final_score;
    }

    const award =
      currentPosition === 1
        ? "Winner"
        : currentPosition === 2
          ? "Runner-up"
          : currentPosition === 3
            ? "Third Place"
            : "Certificate of Participation";

    const { error: updateError } = await db
      .schema("musabaqa")
      .from("results")
      .update({ position: currentPosition, award })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }

  await writeAuditLog(db, {
    userId: rankedBy,
    action: "result_ranking",
    entityType: "competition_category",
    entityId: categoryId,
    newValue: { rankedCount: results.length },
  });

  return { rankedCount: results.length };
}

/** Explicit publish step — the only thing that makes a result visible per the competition's result_visibility setting. */
export async function publishResult(db: SupabaseClient, resultId: string, publishedBy: string) {
  const { data, error } = await db
    .schema("musabaqa")
    .from("results")
    .update({ published: true, published_at: new Date().toISOString() })
    .eq("id", resultId)
    .select("id, participant_id, competition_id, category_id, position, award")
    .single();
  if (error) throw error;

  await writeAuditLog(db, {
    userId: publishedBy,
    action: "result_publication",
    entityType: "result",
    entityId: resultId,
    newValue: data,
  });

  return data;
}
