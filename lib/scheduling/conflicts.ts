/**
 * lib/scheduling/conflicts.ts
 *
 * Spec doesn't mandate hard scheduling constraints, and a rigid DB-level
 * exclusion constraint doesn't fit well here (duration comes from the
 * category, not the session, and judges are many-to-many). So this is a
 * soft check: detect overlaps and return human-readable warnings, but
 * never block session creation — an admin might have a legitimate reason
 * (e.g. a chairman briefly present in two rooms) that the system can't
 * judge for them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConflictCheckInput {
  competitionId: string;
  scheduledTime: string | null; // ISO timestamp
  durationMinutes: number | null;
  judgeIds: string[];
  room: string | null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function detectSchedulingConflicts(db: SupabaseClient, input: ConflictCheckInput): Promise<string[]> {
  if (!input.scheduledTime) return []; // nothing to check without a time

  const duration = input.durationMinutes ?? 30;
  const thisStart = new Date(input.scheduledTime).getTime();
  const thisEnd = thisStart + duration * 60_000;

  const { data: otherSessions, error } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select(
      "id, scheduled_time, room, competition_categories(duration_minutes), session_judges(judge_id, judges(full_name)), participants(full_name)"
    )
    .eq("competition_id", input.competitionId)
    .not("scheduled_time", "is", null)
    .not("status", "eq", "CANCELLED");
  if (error) throw error;

  const warnings: string[] = [];
  const judgeIdSet = new Set(input.judgeIds);

  for (const s of otherSessions ?? []) {
    if (!s.scheduled_time) continue;
    const cat = Array.isArray(s.competition_categories) ? s.competition_categories[0] : s.competition_categories;
    const otherDuration = cat?.duration_minutes ?? 30;
    const otherStart = new Date(s.scheduled_time).getTime();
    const otherEnd = otherStart + otherDuration * 60_000;

    if (!overlaps(thisStart, thisEnd, otherStart, otherEnd)) continue;

    const otherParticipant = Array.isArray(s.participants) ? s.participants[0] : s.participants;
    const otherJudges = (s.session_judges ?? []) as { judge_id: string; judges: { full_name: string } | { full_name: string }[] }[];

    for (const oj of otherJudges) {
      if (judgeIdSet.has(oj.judge_id)) {
        const judgeInfo = Array.isArray(oj.judges) ? oj.judges[0] : oj.judges;
        warnings.push(
          `${judgeInfo?.full_name ?? "A judge"} is already scheduled for ${otherParticipant?.full_name ?? "another session"} at an overlapping time.`
        );
      }
    }

    if (input.room && s.room && input.room.trim().toLowerCase() === s.room.trim().toLowerCase()) {
      warnings.push(`Room "${input.room}" is already booked for ${otherParticipant?.full_name ?? "another session"} at an overlapping time.`);
    }
  }

  return warnings;
}
