import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { registerParticipant, RegistrationError } from "@/lib/participants/register";

/**
 * POST /api/register
 *
 * Public registration endpoint (spec section 12). Uses the admin client
 * deliberately — anonymous registrants have no auth session for RLS to
 * scope to, so registerParticipant()'s own server-side validation (open
 * registration window, category active, age/gender eligibility, capacity)
 * IS the authorization boundary here, not RLS. This is exactly the "secure
 * server-side operation, never trust the frontend" pattern from section 2.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (typeof input.fullName !== "string" || typeof input.competitionId !== "string" || typeof input.categoryId !== "string") {
    return NextResponse.json({ error: "fullName, competitionId, and categoryId are required." }, { status: 400 });
  }

  try {
    const db = getAdminClient();
    const participant = await registerParticipant(db, {
      fullName: input.fullName,
      competitionId: input.competitionId,
      categoryId: input.categoryId,
      dateOfBirth: typeof input.dateOfBirth === "string" ? input.dateOfBirth : undefined,
      gender: input.gender === "Male" || input.gender === "Female" ? input.gender : undefined,
      country: typeof input.country === "string" ? input.country : undefined,
      state: typeof input.state === "string" ? input.state : undefined,
      lga: typeof input.lga === "string" ? input.lga : undefined,
      city: typeof input.city === "string" ? input.city : undefined,
      organization: typeof input.organization === "string" ? input.organization : undefined,
      teacher: typeof input.teacher === "string" ? input.teacher : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      email: typeof input.email === "string" ? input.email : undefined,
      emergencyContactName: typeof input.emergencyContactName === "string" ? input.emergencyContactName : undefined,
      emergencyContactPhone: typeof input.emergencyContactPhone === "string" ? input.emergencyContactPhone : undefined,
    });

    // Only ever return the public-facing code, never the internal uuid (spec section 12).
    return NextResponse.json({ participantCode: participant.participant_code, status: participant.status });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Registration failed:", err);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
