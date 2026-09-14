import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

import { ORG_COOKIE, ORG_COOKIE_MAX_AGE } from "@/constants/auth";
import { PLATFORM_HOME, resolveAccess } from "@/lib/auth/access";
import { defaultLandingPath, sanitizeNextPath } from "@/lib/auth/routes";
import { MembershipService } from "@/services/membership-service";
import { PlatformService } from "@/services/platform/platform-service";

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

  const [memberships, platformAdmin] = await Promise.all([
    new MembershipService(supabase).listActiveForUser(user.id),
    new PlatformService(supabase).isPlatformAdmin(),
  ]);

  // El administrador de la plataforma nunca pasa por la selección (KAM-26):
  // si su organización de la cookie sigue valiendo, aterriza como todos; si
  // no, en la vista de plataforma —o en la ruta de plataforma que pedía—.
  if (platformAdmin) {
    const cookieOrgId = (await cookies()).get(ORG_COOKIE)?.value;
    const cookieOrganization =
      cookieOrgId && !memberships.some((m) => m.organizationId === cookieOrgId)
        ? await new PlatformService(supabase).findActiveOrganization(cookieOrgId)
        : null;
    const resolution = resolveAccess({
      memberships,
      platformAdmin,
      cookieOrgId,
      cookieOrganization,
    });
    if (resolution.kind === "active") return destination;
    return next && isPlatformPath(next) ? next : PLATFORM_HOME;
  }

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

/** Las rutas de la plataforma, que no necesitan organización activa. */
export function isPlatformPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}
