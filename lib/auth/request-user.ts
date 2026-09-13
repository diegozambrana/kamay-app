import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { MembershipService } from "@/services/membership-service";

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
