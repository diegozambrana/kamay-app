import "server-only";

import { orderRequestReceivedKey } from "@/lib/notifications/dedupe";
import type { PlannedNotification } from "@/lib/notifications/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { NotificationGenerator } from "./generator";
import { PreferenceService } from "./preference-service";

/**
 * KAM-28 · El aviso de «solicitud de pedido recibida», emitido desde la
 * Server Action pública que procesa el envío — nunca desde SQL.
 *
 * Mismo reparto de clientes que `emit-task-events.ts` (design D5 de
 * `notifications`, y design D4 de este cambio): el envío ya se marcó con el
 * cliente sin sesión de `resolve_order_request`/`submit_order_request`, con
 * su propia RLS; solo la creación del aviso pasa por el cliente privilegiado,
 * y únicamente para insertar en `notifications` a nombre de cada dueño de la
 * organización que la RPC ya resolvió. `services/notifications/` es el único
 * lugar permitido para importar `lib/supabase/admin.ts`
 * (`service-role-boundary.test.ts`); ninguna Server Action lo hace.
 *
 * Solo a los dueños — nunca al ayudante, por definición de producto (spec
 * `notifications` — Requirement: El envío público genera el aviso de
 * solicitud recibida, solo a los dueños). `order_request_received` no está
 * en `EMAIL_TYPES`, así que no hace falta resolver correos.
 *
 * **Nunca lanza.** La solicitud ya quedó recibida cuando esto se llama; un
 * fallo al avisar no puede deshacer eso.
 */
export async function emitOrderRequestReceived(input: {
  organizationId: string;
  requestId: string;
  title: string;
  body: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: owners, error } = await admin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", input.organizationId)
      .eq("role", "owner")
      .is("archived_at", null)
      .overrideTypes<{ user_id: string }[]>();

    if (error || !owners || owners.length === 0) return;

    const preferences = new PreferenceService(admin);
    const resolved = await preferences.forOrganization(
      input.organizationId,
      owners.map((owner) => owner.user_id),
    );

    const planned: PlannedNotification[] = owners
      .filter((owner) => resolved.get(owner.user_id)?.order_request_received)
      .map((owner) => ({
        organizationId: input.organizationId,
        userId: owner.user_id,
        type: "order_request_received" as const,
        title: input.title,
        body: input.body,
        entityType: "order_request" as const,
        entityId: input.requestId,
        dedupeKey: orderRequestReceivedKey(input.requestId),
      }));

    if (planned.length === 0) return;

    await new NotificationGenerator(admin).emit(planned);
  } catch (error) {
    console.error(
      "[notifications] no se pudo emitir el aviso de solicitud recibida:",
      error,
    );
  }
}
