/**
 * lib/participants/checkin.ts
 *
 * Spec section 22: QR check-in. Two-step flow, matching how it actually
 * happens at a venue:
 *
 *  1. lookupParticipantForCheckin() — judge/admin scans the QR, app shows
 *     name/photo/category/session WITHOUT committing anything yet.
 *  2. confirmCheckin() — judge/admin explicitly confirms, which is when the
 *     checkin row actually gets written.
 *
 * Duplicate check-in is prevented at the database level (UNIQUE constraint
 * on checkins.session_id), not just in application logic — so even a race
 * between two devices scanning the same participant can't create two rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";

export class CheckinError extends Error {}

export interface CheckinLookupResult {
  participant: {
    id: string;
    participant_code: string;
    full_name: string;
    photo_url: string | null;
  };
  session: {
    id: string;
    status: string;
    room: string | null;
    scheduled_time: string | null;
  };
  category: {
    id: string;
    category_name: string;
  };
  alreadyCheckedIn: boolean;
}

/**
 * Resolves a scanned qr_token to the participant's active session for the
 * given competition, without writing anything. Throws if the token is
 * unknown or the participant has no session in this competition yet
 * (e.g. admin hasn't created their session/schedule slot).
 */
export async function lookupParticipantForCheckin(
  db: SupabaseClient,
  qrToken: string,
  competitionId: string
): Promise<CheckinLookupResult> {
  const { data: participant, error: participantError } = await db
    .schema("musabaqa")
    .from("participants")
    .select("id, participant_code, full_name, photo_url")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (participantError) throw participantError;
  if (!participant) throw new CheckinError("QR code not recognized.");

  const { data: session, error: sessionError } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select("id, status, room, scheduled_time, category_id, competition_categories(id, category_name)")
    .eq("participant_id", participant.id)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) {
    throw new CheckinError(
      `${participant.full_name} (${participant.participant_code}) has no scheduled session for this competition yet.`
    );
  }

  const { data: existingCheckin } = await db
    .schema("musabaqa")
    .from("checkins")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();

  const category = Array.isArray(session.competition_categories)
    ? session.competition_categories[0]
    : session.competition_categories;

  return {
    participant,
    session: { id: session.id, status: session.status, room: session.room, scheduled_time: session.scheduled_time },
    category: { id: category?.id, category_name: category?.category_name },
    alreadyCheckedIn: !!existingCheckin,
  };
}

export interface ConfirmCheckinInput {
  sessionId: string;
  participantId: string;
  checkedInBy: string; // auth.users.id of the judge/admin confirming
  deviceInfo?: string;
}

export async function confirmCheckin(db: SupabaseClient, input: ConfirmCheckinInput) {
  // Rely on the UNIQUE(session_id) constraint to be the actual source of
  // truth for "already checked in" — this insert simply fails if so.
  const { data, error } = await db
    .schema("musabaqa")
    .from("checkins")
    .insert({
      session_id: input.sessionId,
      participant_id: input.participantId,
      checked_in_by: input.checkedInBy,
      device_info: input.deviceInfo ?? null,
    })
    .select("id, checked_in_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      // unique_violation
      throw new CheckinError("This participant has already been checked in for this session.");
    }
    throw error;
  }

  const { error: updateError } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .update({ status: "CHECKED_IN" })
    .eq("id", input.sessionId);
  if (updateError) throw updateError;

  await writeAuditLog(db, {
    userId: input.checkedInBy,
    action: "participant_checkin",
    entityType: "competition_session",
    entityId: input.sessionId,
    newValue: { participantId: input.participantId, checkedInAt: data.checked_in_at },
  });

  return data;
}
