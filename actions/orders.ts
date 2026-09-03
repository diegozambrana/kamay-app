"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session-context";
import { orderErrorMessage } from "@/lib/orders/errors";
import {
  midpoint,
  reorderedIds,
  renormalize,
  sortByArrival,
} from "@/lib/orders/queue";
import {
  moveOrderSchema,
  orderIdSchema,
  reorderQueueSchema,
} from "@/lib/orders/schema";
import { StatusService } from "@/services/configuration/status-service";
import { OrderService } from "@/services/orders/order-service";

export type ActionResult = { error: string } | undefined;

const NO_SESSION = "Tu sesión terminó. Vuelve a entrar.";

function revalidateOrders(orderId?: string) {
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

/**
 * Mover un pedido a otra columna.
 *
 * La interfaz solo ofrece columnas válidas, pero la acción no confía en la
 * interfaz: el destino se comprueba contra el juego resuelto de la línea del
 * pedido (design.md D6). `queued_at` lo ajusta el trigger de la base según el
 * `is_queue` del destino — aquí no se toca.
 */
export async function moveOrderToStatus(
  input: unknown,
): Promise<ActionResult> {
  const parsed = moveOrderSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el pedido." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const { orderId, statusId } = parsed.data;
  const orders = new OrderService(context.supabase);

  try {
    const order = await orders.getById(context.organizationId, orderId);
    if (!order) return { error: "Ese pedido ya no está a tu alcance." };

    // El juego aplicable lo resuelve la base (`resolve_statuses`); el destino
    // tiene que pertenecer al de la línea de ESTE pedido, no al de la línea
    // que el usuario tenga activa.
    const statuses = await new StatusService(context.supabase).resolve(
      context.organizationId,
      order.businessLineId,
      "order",
    );

    if (!statuses.some((status) => status.id === statusId)) {
      return { error: "Ese estado no pertenece al flujo de esta línea." };
    }

    await orders.moveToStatus(context.organizationId, orderId, statusId);
  } catch (error) {
    return { error: orderErrorMessage(error, "No se pudo mover el pedido.") };
  }

  revalidateOrders(orderId);
}

/**
 * Reordenar dentro de la columna en cola.
 *
 * La posición visible se deriva del orden por `queued_at`, así que mover uno
 * basta para renumerar a todos: se le asigna el punto medio entre sus nuevas
 * vecinas. Si ya no cabe un valor entre ellas, se reespacia la columna entera
 * una vez y se reintenta (design.md D4).
 */
export async function reorderQueue(input: unknown): Promise<ActionResult> {
  const parsed = reorderQueueSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo reordenar la cola." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const { orderId, targetIndex } = parsed.data;
  const orders = new OrderService(context.supabase);

  try {
    const order = await orders.getById(context.organizationId, orderId);
    if (!order) return { error: "Ese pedido ya no está a tu alcance." };
    if (!order.queuedAt) {
      return { error: "Ese pedido no está en la columna de cola." };
    }

    // Los compañeros de columna, en su orden actual de llegada.
    const column = sortByArrival(
      await orders.list(context.organizationId, {
        businessLineId: order.businessLineId,
        statusId: order.statusId,
      }),
    );

    const ordered = reorderedIds(
      column.map((o) => o.id),
      orderId,
      targetIndex,
    );
    const position = ordered.indexOf(orderId);
    const byId = new Map(column.map((o) => [o.id, o]));

    const before = position > 0 ? byId.get(ordered[position - 1])?.queuedAt ?? null : null;
    const after =
      position < ordered.length - 1
        ? byId.get(ordered[position + 1])?.queuedAt ?? null
        : null;

    const spot = midpoint(before, after);

    if (spot.kind === "ok") {
      await orders.setQueuedAt(context.organizationId, orderId, spot.queuedAt);
    } else {
      // Las vecinas quedaron demasiado juntas: se reespacia la columna con el
      // orden deseado ya aplicado, y el problema desaparece por mucho tiempo.
      await orders.setManyQueuedAt(context.organizationId, renormalize(ordered));
    }
  } catch (error) {
    return { error: orderErrorMessage(error, "No se pudo reordenar la cola.") };
  }

  revalidateOrders(orderId);
}

/**
 * Archivar y desarchivar. Quién puede hacerlo lo decide el trigger
 * `enforce_archive_rules` de la base: aquí no se comprueba el rol, solo se
 * traduce su rechazo (design.md D7).
 */
export async function archiveOrder(input: unknown): Promise<ActionResult> {
  return setArchived(input, true, "No se pudo archivar el pedido.");
}

export async function unarchiveOrder(input: unknown): Promise<ActionResult> {
  return setArchived(input, false, "No se pudo desarchivar el pedido.");
}

async function setArchived(
  input: unknown,
  archived: boolean,
  fallback: string,
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar el pedido." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new OrderService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.orderId,
      archived,
    );
  } catch (error) {
    return { error: orderErrorMessage(error, fallback) };
  }

  revalidateOrders(parsed.data.orderId);
}
