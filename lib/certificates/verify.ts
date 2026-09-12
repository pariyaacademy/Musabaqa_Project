/**
 * lib/certificates/verify.ts
 *
 * Spec sections 33-34. Public verification by certificate code or
 * participant code. Deliberately returns a narrow, hand-picked set of
 * fields — even though certificates/results RLS allows public SELECT at
 * the row level, THIS function is what actually shapes the public API
 * response, and it never returns phone/email/address/photo/etc.
 *
 * Rate limiting enumeration attempts (section 34) is an infrastructure
 * concern (e.g. a rate limiter in front of the route that calls this) —
 * not something this function can enforce on its own, noted here so it
 * isn't forgotten when wiring the actual route.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface VerificationResult {
  valid: boolean;
  participantName?: string;
  competitionName?: string;
  categoryName?: string;
  position?: number | null;
  issueDate?: string;
}

export async function verifyCertificate(db: SupabaseClient, certificateCode: string): Promise<VerificationResult> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("certificates")
    .select(
      "issue_date, participants(full_name), competitions(name), competition_categories(category_name), results(position)"
    )
    .eq("certificate_code", certificateCode.trim())
    .maybeSingle();

  if (error) throw error;
  if (!data) return { valid: false };

  const participant = Array.isArray(data.participants) ? data.participants[0] : data.participants;
  const competition = Array.isArray(data.competitions) ? data.competitions[0] : data.competitions;
  const category = Array.isArray(data.competition_categories) ? data.competition_categories[0] : data.competition_categories;
  const result = Array.isArray(data.results) ? data.results[0] : data.results;

  return {
    valid: true,
    participantName: participant?.full_name,
    competitionName: competition?.name,
    categoryName: category?.category_name,
    position: result?.position ?? null,
    issueDate: data.issue_date,
  };
}

/** Verification by participant_code instead of certificate_code — spec section 34. */
export async function verifyByParticipantCode(
  db: SupabaseClient,
  participantCode: string
): Promise<VerificationResult> {
  const { data: participant, error: participantError } = await db
    .schema("musabaqa")
    .from("participants")
    .select("id")
    .eq("participant_code", participantCode.trim())
    .maybeSingle();
  if (participantError) throw participantError;
  if (!participant) return { valid: false };

  const { data: certificate, error: certError } = await db
    .schema("musabaqa")
    .from("certificates")
    .select("certificate_code")
    .eq("participant_id", participant.id)
    .maybeSingle();
  if (certError) throw certError;
  if (!certificate) return { valid: false };

  return verifyCertificate(db, certificate.certificate_code);
}
