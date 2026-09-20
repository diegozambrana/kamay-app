import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { OrganizationToolService } from "@/services/tools/organization-tool-service";

/**
 * KAM-27 · Los identificadores de las herramientas activas de la organización,
 * **una sola vez por petición** (design D5; mismo patrón que
 * `lib/auth/request-user.ts`). El cascarón los necesita para el menú, y la
 * página de una herramienta o el detalle de un pedido los vuelven a pedir en
 * el mismo render: `cache()` lo deja en una sola llamada.
 *
 * **Un fallo aquí no tumba la aplicación.** Esta lectura ocurre en el cascarón
 * de todas las pantallas; si la función no responde, lo correcto es un menú
 * sin herramientas —que es como se ve una organización que no activó
 * ninguna—, no un taller entero sin poder registrar una venta.
 */
export const getRequestActiveToolSlugs = cache(async (organizationId: string): Promise<string[]> => {
  try {
    const supabase = await createClient();
    return await new OrganizationToolService(supabase).activeSlugs(organizationId);
  } catch (error) {
    console.error("[tools] no se pudieron cargar las herramientas activas", error);
    return [];
  }
});
