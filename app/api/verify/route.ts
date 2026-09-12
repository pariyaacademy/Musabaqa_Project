import { NextRequest, NextResponse } from "next/server";
import { getPublicClient } from "@/lib/supabase/public";
import { verifyCertificate } from "@/lib/certificates/verify";

/**
 * GET /api/verify?code=CERT-MQ26-00152
 *
 * Public certificate verification (spec section 33). Uses the anon/public
 * client — this is intentionally readable by anyone, that's the point of
 * public verification — but verifyCertificate() itself is what limits the
 * response to non-sensitive fields (name/competition/category/position/date).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !code.trim()) {
    return NextResponse.json({ error: "A certificate code is required." }, { status: 400 });
  }

  try {
    const db = getPublicClient();
    const result = await verifyCertificate(db, code);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Verification failed:", err);
    return NextResponse.json({ error: "Verification failed." }, { status: 500 });
  }
}
