"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { publicOrderCommentSchema } from "@/lib/order-shares/schema";
import { orderShareUrlFor } from "@/lib/order-shares/share-url";
import { createPublicClient } from "@/lib/supabase/public";
import { OrderShareService } from "@/services/order-shares/order-share-service";
import { emitOrderCommentReceived } from "@/services/notifications/emit-order-comment-events";

/**
 * KAM-32 · Enlace público de seguimiento de un pedido y comentarios.
 *
 * Misma frontera que `actions/order-requests.ts` (KAM-28): generar,
 * regenerar, revocar y archivar un comentario los llama alguien con sesión.
 * `submitOrderComment` la llama alguien sin sesión desde `/p/<token>`, con
 * `createPublicClient()` — nunca `getSessionContext` — para que la RPC corra
 * siempre como `anon`.
 */

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const GENERIC_ERROR = "No se pudo completar la operación. Intenta de nuevo.";
const LINK_INVALID = "Este enlace ya no sirve.";

const idSchema = z.guid();

function revalidateOrder(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
}

/** Genera el enlace y devuelve la URL en claro **una sola vez**. */
export async function generateOrderShare(
  orderId: string,
): Promise<{ error: string } | { id: string; url: string }> {
  const parsedOrder = idSchema.safeParse(orderId);
  if (!parsedOrder.success) return { error: "No se pudo identificar el pedido." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const { share, token } = await new OrderShareService(context.supabase).create(
      context.organizationId,
      { orderId: parsedOrder.data, createdBy: context.userId },
    );

    const host = (await headers()).get("host") ?? "";
    revalidateOrder(parsedOrder.data);
    return { id: share.id, url: orderShareUrlFor(host, token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : GENERIC_ERROR };
  }
}

/** Regenera el enlace de un pedido; el anterior deja de resolver. */
export async function regenerateOrderShare(
  orderId: string,
  shareId: string,
): Promise<{ error: string } | { url: string }> {
  const parsedOrder = idSchema.safeParse(orderId);
  const parsedShare = idSchema.safeParse(shareId);
  if (!parsedOrder.success || !parsedShare.success) {
    return { error: "No se pudo identificar el pedido o el enlace." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const token = await new OrderShareService(context.supabase).regenerate(
      context.organizationId,
      parsedShare.data,
    );
    const host = (await headers()).get("host") ?? "";
    revalidateOrder(parsedOrder.data);
    return { url: orderShareUrlFor(host, token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : GENERIC_ERROR };
  }
}

/** Revocar corta el acceso de inmediato; la fila queda archivada. */
export async function revokeOrderShare(
  orderId: string,
  shareId: string,
): Promise<ActionResult> {
  const parsedOrder = idSchema.safeParse(orderId);
  const parsedShare = idSchema.safeParse(shareId);
  if (!parsedOrder.success || !parsedShare.success) {
    return { error: "No se pudo identificar el pedido o el enlace." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new OrderShareService(context.supabase).revoke(context.organizationId, parsedShare.data);
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidateOrder(parsedOrder.data);
}

/** La organización retira un comentario del detalle: se archiva, no se borra. */
export async function archiveOrderComment(
  orderId: string,
  commentId: string,
): Promise<ActionResult> {
  const parsedOrder = idSchema.safeParse(orderId);
  const parsedComment = idSchema.safeParse(commentId);
  if (!parsedOrder.success || !parsedComment.success) {
    return { error: "No se pudo identificar el pedido o el comentario." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new OrderShareService(context.supabase).archiveComment(
      context.organizationId,
      parsedComment.data,
    );
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidateOrder(parsedOrder.data);
}

/**
 * El comentario del cliente, sin sesión. `createPublicClient()` no lee
 * ninguna cookie, así que `submit_order_comment` corre siempre como `anon`,
 * la bitácora atribuye el evento a «Cliente», y el aviso —generado aparte,
 * nunca desde SQL— llega solo a los dueños que lo tengan activo.
 */
export async function submitOrderComment(
  token: string,
  input: unknown,
): Promise<ActionResult> {
  if (typeof token !== "string" || token.trim() === "") {
    return { error: LINK_INVALID };
  }

  const parsed = publicOrderCommentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .rpc("submit_order_comment", {
      p_token: token,
      p_name: parsed.data.name,
      p_body: parsed.data.body,
    })
    .single<{ organization_id: string; order_id: string; comment_id: string }>();

  if (error || !data) {
    return { error: error?.message ?? LINK_INVALID };
  }

  await emitOrderCommentReceived({
    organizationId: data.organization_id,
    orderId: data.order_id,
    commentId: data.comment_id,
    title: "Nuevo comentario en un pedido",
    body: `${parsed.data.name}: ${parsed.data.body}`,
  });
}
