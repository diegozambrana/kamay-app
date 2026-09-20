import "server-only";

import { orderCommentReceivedKey } from "@/lib/notifications/dedupe";
import type { PlannedNotification } from "@/lib/notifications/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { NotificationGenerator } from "./generator";
import { PreferenceService } from "./preference-service";

/**
 * KAM-32 · El aviso de «comentario recibido», emitido desde la Server Action
 * pública que procesa el comentario — nunca desde SQL. Mismo patrón que
 * `emit-order-request-events.ts` de KAM-28 (design D4 de esa propuesta):
 * `services/notifications/` es el único lugar permitido para importar
 * `lib/supabase/admin.ts` (`service-role-boundary.test.ts`).
 *
 * Solo a los dueños. `order_comment_received` no está en `EMAIL_TYPES`.
 * **Nunca lanza**: el comentario ya quedó recibido cuando esto se llama.
 */
export async function emitOrderCommentReceived(input: {
  organizationId: string;
  orderId: string;
  commentId: string;
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
      .filter((owner) => resolved.get(owner.user_id)?.order_comment_received)
      .map((owner) => ({
        organizationId: input.organizationId,
        userId: owner.user_id,
        type: "order_comment_received" as const,
        title: input.title,
        body: input.body,
        entityType: "order" as const,
        entityId: input.orderId,
        dedupeKey: orderCommentReceivedKey(input.commentId),
      }));

    if (planned.length === 0) return;

    await new NotificationGenerator(admin).emit(planned);
  } catch (error) {
    console.error(
      "[notifications] no se pudo emitir el aviso de comentario recibido:",
      error,
    );
  }
}
