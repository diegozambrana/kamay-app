"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth/session-context";
import { orderRequestUrlFor } from "@/lib/order-requests/request-url";
import { publicOrderRequestSchema } from "@/lib/order-requests/schema";
import { createPublicClient } from "@/lib/supabase/public";
import { OrderRequestService } from "@/services/order-requests/order-request-service";
import { emitOrderRequestReceived } from "@/services/notifications/emit-order-request-events";

/**
 * KAM-28 · Solicitudes de pedido por enlace público.
 *
 * Dos mundos en un mismo archivo, y la frontera importa: `generateOrderRequest`,
 * `regenerateOrderRequestLink`, `discardOrderRequest` y `acceptOrderRequest`
 * las llama alguien con sesión (`getSessionContext`, `is_member` de sobra en
 * la base). `submitOrderRequest` la llama alguien **sin** sesión desde
 * `/r/<token>`, así que usa `createPublicClient()` — nunca `getSessionContext`
 * ni el cliente de `lib/supabase/server.ts` — para que la RPC corra siempre
 * como `anon`, igual la abra quien la abra (design D7).
 */

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";
const GENERIC_ERROR = "No se pudo completar la operación. Intenta de nuevo.";
const LINK_INVALID = "Este enlace ya no sirve. Pide uno nuevo.";

const idSchema = z.guid();

const generateSchema = z.object({
  id: idSchema,
  businessLineId: idSchema,
  contactId: idSchema.nullable(),
  prefilledName: z.string().trim().min(1, "Escribe el nombre"),
  prefilledPhone: z.string().trim().min(1, "Escribe el teléfono"),
});

function revalidateInbox(id?: string) {
  revalidatePath("/orders/requests");
  if (id) revalidatePath(`/orders/requests/${id}`);
}

/** Genera la solicitud y devuelve la URL en claro **una sola vez**. */
export async function generateOrderRequest(
  input: unknown,
): Promise<{ error: string } | { id: string; url: string }> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const { orderRequest, token } = await new OrderRequestService(
      context.supabase,
    ).create(context.organizationId, {
      ...parsed.data,
      createdBy: context.userId,
    });

    const host = (await headers()).get("host") ?? "";
    revalidateInbox();
    return { id: orderRequest.id, url: orderRequestUrlFor(host, token) };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

/** Regenera el enlace mientras la solicitud siga esperando al cliente. */
export async function regenerateOrderRequestLink(
  id: string,
): Promise<{ error: string } | { url: string }> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "No se pudo identificar la solicitud." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    const token = await new OrderRequestService(context.supabase).regenerate(
      context.organizationId,
      parsed.data,
    );
    const host = (await headers()).get("host") ?? "";
    revalidateInbox(parsed.data);
    return { url: orderRequestUrlFor(host, token) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : GENERIC_ERROR,
    };
  }
}

/** Descartar archiva, nunca borra. */
export async function discardOrderRequest(id: string): Promise<ActionResult> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "No se pudo identificar la solicitud." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new OrderRequestService(context.supabase).discard(
      context.organizationId,
      parsed.data,
    );
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidateInbox(parsed.data);
}

/**
 * Aceptar: el pedido ya existe —lo creó `createOrder`, sin tocarlo—; esta
 * acción solo traslada las imágenes de la cuarentena y vincula el resultado.
 */
export async function acceptOrderRequest(
  requestId: string,
  orderId: string,
): Promise<ActionResult> {
  const parsedRequest = idSchema.safeParse(requestId);
  const parsedOrder = idSchema.safeParse(orderId);
  if (!parsedRequest.success || !parsedOrder.success) {
    return { error: "No se pudo identificar la solicitud o el pedido." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new OrderRequestService(context.supabase).accept(
      context.organizationId,
      parsedRequest.data,
      parsedOrder.data,
      context.userId,
    );
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidateInbox(parsedRequest.data);
  revalidatePath(`/orders/${parsedOrder.data}`);
}

/**
 * El envío del formulario público. Sin sesión: `createPublicClient()` no lee
 * ninguna cookie, así que `submit_order_request` corre siempre como `anon`,
 * la bitácora atribuye el evento a «Formulario público» (design D3) y el
 * aviso —generado aparte, nunca desde SQL (design D4)— llega solo a los
 * dueños que lo tengan activo.
 */
export async function submitOrderRequest(
  token: string,
  input: unknown,
): Promise<ActionResult> {
  if (typeof token !== "string" || token.trim() === "") {
    return { error: LINK_INVALID };
  }

  const parsed = publicOrderRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .rpc("submit_order_request", {
      p_token: token,
      p_name: parsed.data.name,
      p_phone: parsed.data.phone,
      p_note: parsed.data.note,
    })
    .single<{ organization_id: string; request_id: string }>();

  if (error || !data) return { error: LINK_INVALID };

  await emitOrderRequestReceived({
    organizationId: data.organization_id,
    requestId: data.request_id,
    title: "Nueva solicitud de pedido",
    body: `${parsed.data.name} mandó sus datos por el enlace público.`,
  });
}
