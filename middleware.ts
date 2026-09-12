import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * middleware.ts
 *
 * Two jobs:
 *  1. Keep the Supabase session cookie fresh on every request (the standard
 *     @supabase/ssr pattern — without this, sessions silently expire).
 *  2. Gate /judge/* and /admin/* server-side by musabaqa role. This is
 *     UX convenience (fast redirect), NOT the real security boundary —
 *     the real boundary is RLS on every table, which holds even if this
 *     middleware were somehow bypassed.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsJudge = path.startsWith("/judge");
  const needsAdmin = path.startsWith("/admin");

  if ((needsJudge || needsAdmin) && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (needsJudge && user) {
    const { data: roles } = await supabase.schema("musabaqa").from("user_roles").select("role").eq("user_id", user.id);
    const roleNames = (roles ?? []).map((r) => r.role);
    if (!roleNames.includes("judge") && !roleNames.includes("super_admin")) {
      return NextResponse.redirect(new URL("/not-authorized", request.url));
    }
  }

  if (needsAdmin && user) {
    const { data: roles } = await supabase.schema("musabaqa").from("user_roles").select("role").eq("user_id", user.id);
    const roleNames = (roles ?? []).map((r) => r.role);
    if (!roleNames.includes("competition_admin") && !roleNames.includes("super_admin")) {
      return NextResponse.redirect(new URL("/not-authorized", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/judge/:path*", "/admin/:path*"],
};
