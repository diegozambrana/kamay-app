import { NextResponse, type NextRequest } from "next/server";

import { resolvePostAuthPath } from "@/lib/auth/post-auth";
import { createClient } from "@/lib/supabase/server";

/** Intercambio de código por sesión (flujo PKCE). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = await resolvePostAuthPath(supabase, next);
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=invalid-link", request.url),
  );
}
