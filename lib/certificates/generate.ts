/**
 * lib/certificates/generate.ts
 *
 * Spec section 32. A certificate can only be generated for a PUBLISHED
 * result — generating one for a draft/unpublished result would let someone
 * hold "proof" of a result the competition hasn't actually finalized yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAuditLog } from "../audit/log";
import { generateVerificationQrDataUrl, type QrOptions } from "../participants/qr";

export class CertificateError extends Error {}

export async function generateCertificate(
  db: SupabaseClient,
  resultId: string,
  issuedBy: string,
  qrOpts: QrOptions
) {
  const { data: result, error: resultError } = await db
    .schema("musabaqa")
    .from("results")
    .select("id, published, participant_id, competition_id, category_id, position, final_score, participants(participant_code)")
    .eq("id", resultId)
    .single();
  if (resultError) throw resultError;

  if (!result.published) {
    throw new CertificateError("Cannot generate a certificate for an unpublished result.");
  }

  const participant = Array.isArray(result.participants) ? result.participants[0] : result.participants;
  if (!participant?.participant_code) {
    throw new CertificateError("Participant record is missing a participant_code — cannot derive certificate code.");
  }

  const certificateCode = `CERT-${participant.participant_code}`;

  const { data: certificate, error: insertError } = await db
    .schema("musabaqa")
    .from("certificates")
    .insert({
      certificate_code: certificateCode,
      result_id: result.id,
      participant_id: result.participant_id,
      competition_id: result.competition_id,
      category_id: result.category_id,
    })
    .select("id, certificate_code, qr_token, issue_date")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new CertificateError(`A certificate (${certificateCode}) already exists for this result.`);
    }
    throw insertError;
  }

  const qrDataUrl = await generateVerificationQrDataUrl(certificate.qr_token, qrOpts);

  await writeAuditLog(db, {
    userId: issuedBy,
    action: "certificate_generation",
    entityType: "certificate",
    entityId: certificate.id,
    newValue: { certificateCode: certificate.certificate_code, resultId },
  });

  return { ...certificate, qrDataUrl };
}
