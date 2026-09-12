import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { requireSignedIn, AuthError } from "@/lib/auth/require-admin";
import { generateCertificate, CertificateError } from "@/lib/certificates/generate";

export async function POST(req: NextRequest) {
  const db = getServerClient();
  try {
    const userId = await requireSignedIn(db);
    const body = await req.json();
    if (typeof body.resultId !== "string") {
      return NextResponse.json({ error: "resultId is required." }, { status: 400 });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    const certificate = await generateCertificate(db, body.resultId, userId, { appBaseUrl });
    return NextResponse.json(certificate);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    if (err instanceof CertificateError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("Certificate generation failed:", err);
    return NextResponse.json({ error: "Failed to generate certificate." }, { status: 500 });
  }
}
