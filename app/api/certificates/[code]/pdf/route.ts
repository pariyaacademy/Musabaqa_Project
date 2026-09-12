import { NextRequest, NextResponse } from "next/server";
import { getPublicClient } from "@/lib/supabase/public";
import { generateVerificationQrDataUrl } from "@/lib/participants/qr";
import { generateCertificatePdf } from "@/lib/certificates/pdf";

/**
 * GET /api/certificates/[code]/pdf
 *
 * Public download — same trust level as /verify (spec section 33), since a
 * certificate is meant to be shown/printed by the participant themselves.
 * Returns 404 for any code that doesn't resolve to a real certificate,
 * rather than leaking which of "not found" vs "not permitted" applies.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const db = getPublicClient();

  const { data, error } = await db
    .schema("musabaqa")
    .from("certificates")
    .select(
      "certificate_code, issue_date, qr_token, participants(full_name), competitions(name, organizer), competition_categories(category_name), results(position, final_score, award)"
    )
    .eq("certificate_code", params.code.trim())
    .maybeSingle();

  if (error) {
    console.error("Certificate PDF lookup failed:", error);
    return NextResponse.json({ error: "Failed to look up certificate." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  }

  const participant = Array.isArray(data.participants) ? data.participants[0] : data.participants;
  const competition = Array.isArray(data.competitions) ? data.competitions[0] : data.competitions;
  const category = Array.isArray(data.competition_categories) ? data.competition_categories[0] : data.competition_categories;
  const result = Array.isArray(data.results) ? data.results[0] : data.results;

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const qrDataUrl = await generateVerificationQrDataUrl(data.qr_token, { appBaseUrl });

  const pdfBytes = await generateCertificatePdf({
    participantName: participant?.full_name ?? "Participant",
    competitionName: competition?.name ?? "",
    categoryName: category?.category_name ?? "",
    position: result?.position ?? null,
    award: result?.award ?? null,
    finalScore: result?.final_score ?? null,
    certificateCode: data.certificate_code,
    issueDate: data.issue_date,
    organizer: competition?.organizer,
    qrDataUrl,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.certificate_code}.pdf"`,
    },
  });
}
