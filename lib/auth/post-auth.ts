import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { ORG_COOKIE, ORG_COOKIE_MAX_AGE } from "@/constants/auth";
import { defaultLandingPath, sanitizeNextPath } from "@/lib/auth/routes";
import { MembershipService } from "@/services/membership-service";

/** Fija la cookie de organización activa (D6). */
export async function setActiveOrganizationCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, organizationId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: ORG_COOKIE_MAX_AGE,
  });
}

/**
 * Destino tras autenticarse: la ruta `next` válida o el aterrizaje por
 * dispositivo (D5). Con más de una organización activa, primero se pasa por
 * la selección (criterio de aceptación 3), llevando `next` consigo.
 * Con exactamente una, se fija la cookie y se continúa directo.
 */
export async function resolvePostAuthPath(
  supabase: SupabaseClient,
  nextRaw: string | null | undefined,
): Promise<string> {
  const next = sanitizeNextPath(nextRaw);
  const userAgent = (await headers()).get("user-agent");
  const destination = next ?? defaultLandingPath(userAgent);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return destination;

  const memberships = await new MembershipService(supabase).listActiveForUser(
    user.id,
  );

  if (memberships.length > 1) {
    return next
      ? `/auth/select-org?next=${encodeURIComponent(next)}`
      : "/auth/select-org";
  }

  if (memberships.length === 1) {
    await setActiveOrganizationCookie(memberships[0].organizationId);
  }

  // Sin membresías: el layout de (app) muestra el estado "sin organización".
  return destination;
}
