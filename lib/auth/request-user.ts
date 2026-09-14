import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { ORG_COOKIE } from "@/constants/auth";
import { type AccessResolution, resolveAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";
import { PlatformService } from "@/services/platform/platform-service";

/**
 * El usuario de la petición en curso, validado contra el servidor de Auth
 * **una sola vez por petición** (KAM-23, spec `performance-budget`).
 *
 * El layout de `(app)`, el de Configuración y la página consultaban cada uno
 * `auth.getUser()` por su cuenta: tres idas y vueltas a Auth para la misma
 * persona en la misma petición, multiplicadas por cada precarga de enlace.
 * `cache()` de React las reduce a una dentro del mismo render. No cambia qué
 * se valida ni cómo: sigue siendo `getUser()`, contra el servidor.
 *
 * Fuera de un render —una Server Action— `cache()` no guarda nada y llama
 * cada vez, que es lo mismo que antes.
 */
export const getRequestUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Las membresías vigentes de esa persona, también una vez por petición. */
export const getRequestMemberships = cache(async (userId: string) => {
  const supabase = await createClient();
  return new MembershipService(supabase).listActiveForUser(userId);
});

/**
 * ¿La cuenta es administradora de la plataforma? (KAM-26). Una llamada a
 * `is_platform_admin()` por petición: la respuesta la da la tabla, así que
 * revocar surte efecto en la siguiente petición sin esperar a que caduque el
 * token.
 */
export const getRequestPlatformAdmin = cache(async () => {
  const supabase = await createClient();
  return new PlatformService(supabase).isPlatformAdmin();
});

/**
 * Con qué organización y rol actúa la persona en esta petición (design D6).
 * La regla vive en `resolveAccess`; aquí solo se juntan sus entradas. `null`
 * sin sesión.
 */
export const getRequestAccess = cache(async (): Promise<AccessResolution | null> => {
  const user = await getRequestUser();
  if (!user) return null;

  const [memberships, platformAdmin, cookieStore] = await Promise.all([
    getRequestMemberships(user.id),
    getRequestPlatformAdmin(),
    cookies(),
  ]);
  const cookieOrgId = cookieStore.get(ORG_COOKIE)?.value;

  // Solo el super admin puede estar en una organización a la que no
  // pertenece, y solo para él vale la pena preguntar si existe.
  let cookieOrganization = null;
  if (
    platformAdmin &&
    cookieOrgId &&
    !memberships.some((m) => m.organizationId === cookieOrgId)
  ) {
    const supabase = await createClient();
    cookieOrganization = await new PlatformService(supabase).findActiveOrganization(cookieOrgId);
  }

  return resolveAccess({ memberships, platformAdmin, cookieOrgId, cookieOrganization });
});
