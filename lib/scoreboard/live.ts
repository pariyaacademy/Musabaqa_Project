/**
 * lib/scoreboard/live.ts
 *
 * Spec section 30. The scoreboard's content is governed entirely by
 * musabaqa.competitions.result_visibility (HIDDEN / AFTER_SUBMISSION /
 * AFTER_ROUND / AFTER_COMPLETION) — this module is the single place that
 * interprets that setting, so the UI never has to re-derive the rule.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScoreboardRow {
  participantId: string;
  participantCode: string;
  participantName: string;
  categoryName: string;
  finalScore: number | null;
  position: number | null;
  status: string;
}

/**
 * Fetches the current scoreboard for a category, honoring result_visibility:
 *  - HIDDEN: always returns an empty list (scores never shown mid-competition).
 *  - AFTER_SUBMISSION: shows scores as soon as a session is SCORED, even if
 *    the category isn't finished — some sessions may still show no score yet.
 *  - AFTER_ROUND / AFTER_COMPLETION: only shows PUBLISHED results.
 * (AFTER_ROUND is treated the same as AFTER_COMPLETION at the query level —
 * distinguishing "this round" from "the whole competition" requires a round
 * concept the current schema doesn't have yet; publishing per-round via
 * separate `results` rows already achieves the same practical effect.)
 */
export async function getScoreboard(db: SupabaseClient, categoryId: string): Promise<ScoreboardRow[]> {
  const { data: category, error: categoryError } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, category_name, competition_id, competitions(result_visibility)")
    .eq("id", categoryId)
    .single();
  if (categoryError) throw categoryError;

  const competition = Array.isArray(category.competitions) ? category.competitions[0] : category.competitions;
  const visibility = competition?.result_visibility;

  if (visibility === "HIDDEN") return [];

  if (visibility === "AFTER_SUBMISSION") {
    const { data, error } = await db
      .schema("musabaqa")
      .from("competition_sessions")
      .select("participant_id, status, participants(participant_code, full_name), results(final_score, position)")
      .eq("category_id", categoryId)
      .in("status", ["SCORED", "LOCKED"]);
    if (error) throw error;

    return (data ?? []).map((row) => {
      const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
      const result = Array.isArray(row.results) ? row.results[0] : row.results;
      return {
        participantId: row.participant_id,
        participantCode: participant?.participant_code ?? "",
        participantName: participant?.full_name ?? "",
        categoryName: category.category_name,
        finalScore: result?.final_score ?? null,
        position: result?.position ?? null,
        status: row.status,
      };
    });
  }

  // AFTER_ROUND / AFTER_COMPLETION — published results only.
  const { data, error } = await db
    .schema("musabaqa")
    .from("results")
    .select("participant_id, final_score, position, published, participants(participant_code, full_name)")
    .eq("category_id", categoryId)
    .eq("published", true)
    .order("position", { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
    return {
      participantId: row.participant_id,
      participantCode: participant?.participant_code ?? "",
      participantName: participant?.full_name ?? "",
      categoryName: category.category_name,
      finalScore: row.final_score,
      position: row.position,
      status: "SCORED",
    };
  });
}

/**
 * Subscribes to live changes on results/sessions for a category so the UI
 * can refetch getScoreboard() when something changes, instead of polling.
 * Call the returned unsubscribe function on component unmount.
 */
export function subscribeToScoreboard(
  db: SupabaseClient,
  categoryId: string,
  onChange: () => void
): () => void {
  const channel = db
    .channel(`scoreboard:${categoryId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "musabaqa", table: "results", filter: `category_id=eq.${categoryId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "musabaqa", table: "competition_sessions", filter: `category_id=eq.${categoryId}` },
      onChange
    )
    .subscribe();

  return () => {
    db.removeChannel(channel);
  };
}
