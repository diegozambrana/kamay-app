"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session-context";
import {
  MAX_ATTACHMENTS_PER_RECORD,
  MAX_FILE_SIZE,
} from "@/lib/catalog/photos";
import { orderErrorMessage } from "@/lib/orders/errors";
import {
  midpoint,
  reorderedIds,
  renormalize,
  sortByArrival,
} from "@/lib/orders/queue";
import {
  moveOrderSchema,
  orderAttachmentSchema,
  orderFormSchema,
  orderIdSchema,
  reorderQueueSchema,
} from "@/lib/orders/schema";
import { AttachmentService } from "@/services/catalog/attachment-service";
import { StatusService } from "@/services/configuration/status-service";
import { OrderService } from "@/services/orders/order-service";
import { ATTACHMENTS_BUCKET } from "@/types";

export type ActionResult = { error: string } | undefined;

/** El alta devuelve el número visible para poder anunciarlo sin recargar. */
export type CreateOrderResult =
  | { error: string }
  | { orderId: string; code: number };

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

// ── Alta y edición (V5, KAM-08) ───────────────────────────────────────────

/**
 * Alta de pedido.
 *
 * La organización la pone el contexto de sesión, nunca el formulario: lo que
 * llega del cliente dice qué pedido, no de quién es. El estado inicial lo
 * decide la base (design.md D3), así que aquí no se resuelve ni se envía.
 */
export async function createOrder(input: unknown): Promise<CreateOrderResult> {
  const parsed = orderFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const orders = new OrderService(context.supabase);

  try {
    const orderId = await orders.create(context.organizationId, parsed.data);

    // El número lo asignó el trigger: se relee para poder anunciarlo en
    // «Guardar y crear otro», que no navega a ninguna parte.
    const saved = await orders.getById(context.organizationId, orderId);

    revalidateOrders(orderId);
    return { orderId, code: saved?.code ?? 0 };
  } catch (error) {
    return {
      error: orderErrorMessage(error, "No se pudo guardar el pedido."),
    };
  }
}

/**
 * Edición de pedido. `items` es la lista completa de líneas vigentes: lo que
 * no venga se archiva en la misma transacción (design.md D2).
 *
 * Que un pedido archivado no se pueda editar lo decide la base; aquí solo se
 * traduce su rechazo, igual que con el archivado (design.md D7 de KAM-07).
 */
export async function updateOrder(input: unknown): Promise<ActionResult> {
  const parsed = orderFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const orders = new OrderService(context.supabase);

  try {
    // Que el pedido sea de esta organización lo comprueban RLS y la propia
    // función; leerlo antes permite dar un mensaje entendible en vez de un
    // error de Postgres.
    const order = await orders.getById(context.organizationId, parsed.data.id);
    if (!order) return { error: "Ese pedido ya no está a tu alcance." };

    await orders.update(context.organizationId, parsed.data);
  } catch (error) {
    return {
      error: orderErrorMessage(error, "No se pudo guardar el pedido."),
    };
  }

  revalidateOrders(parsed.data.id);
}

// ── Imágenes de referencia ────────────────────────────────────────────────

/**
 * Un adjunto del pedido. Viaja como `FormData` porque un `File` no sobrevive
 * a la serialización de una Server Action normal.
 *
 * Es una acción aparte del alta a propósito (design.md D10): si la subida
 * falla, el pedido ya está guardado y la persona reintenta la imagen desde la
 * edición, en vez de perder todo lo que escribió.
 */
export async function uploadOrderAttachment(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = orderIdSchema.safeParse({ orderId: formData.get("orderId") });
  if (!parsed.success) return { error: "No se pudo identificar el pedido." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No llegó ningún archivo." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "La imagen no puede pesar más de 5 MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "El archivo tiene que ser una imagen." };
  }

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  const { orderId } = parsed.data;

  try {
    const orders = new OrderService(context.supabase);
    const order = await orders.getById(context.organizationId, orderId);
    if (!order) return { error: "Ese pedido ya no está a tu alcance." };

    const attachments = new AttachmentService(context.supabase);

    // Regla de crecimiento del esquema §13: 20 adjuntos por registro. Se
    // cuenta aquí y no solo en el formulario porque la acción no confía en
    // la interfaz.
    const existing = await attachments.listForEntities(
      context.organizationId,
      "order",
      [orderId],
    );
    if (existing.length >= MAX_ATTACHMENTS_PER_RECORD) {
      return {
        error: `Un pedido no puede tener más de ${MAX_ATTACHMENTS_PER_RECORD} imágenes.`,
      };
    }

    await attachments.upload(context.organizationId, context.userId, {
      // Identificador generado en el servidor: aquí no hay modo sin conexión
      // que servir, el archivo ya está viajando.
      id: crypto.randomUUID(),
      entityType: "order",
      entityId: orderId,
      bucket: ATTACHMENTS_BUCKET,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      body: await file.arrayBuffer(),
    });
  } catch (error) {
    return { error: orderErrorMessage(error, "No se pudo subir la imagen.") };
  }

  revalidateOrders(orderId);
}

/**
 * Quitar una imagen de referencia es archivarla: el objeto sigue en el bucket
 * y ninguna referencia se rompe.
 *
 * A diferencia de la foto de un ítem, **no exige rol de dueño**: la matriz de
 * acceso §16 dice "según el registro padre", y un pedido lo editan ambos
 * roles (design.md D10).
 */
export async function setOrderAttachmentArchived(
  input: unknown,
): Promise<ActionResult> {
  const parsed = orderAttachmentSchema.safeParse(input);
  if (!parsed.success) return { error: "No se pudo identificar la imagen." };

  const context = await getSessionContext();
  if (!context) return { error: NO_SESSION };

  try {
    await new AttachmentService(context.supabase).setArchived(
      context.organizationId,
      parsed.data.id,
      parsed.data.archived,
    );
  } catch (error) {
    return { error: orderErrorMessage(error, "No se pudo quitar la imagen.") };
  }

  revalidateOrders(parsed.data.orderId);
}
