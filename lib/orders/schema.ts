import { z } from "zod";

import { DELIVERY_MODES } from "@/types";

/**
 * Validación de las Server Actions de pedidos. Vive fuera de `actions/`
 * porque un módulo `"use server"` solo puede exportar funciones asíncronas.
 *
 * KAM-07 trajo lo que el tablero y el detalle escriben —mover de estado,
 * reordenar la cola y archivar—. KAM-08 añade el alta y la edición (V5).
 */

const id = z.guid();

/** Mover una tarjeta a otra columna. */
export const moveOrderSchema = z.object({
  orderId: id,
  statusId: id,
});

export type MoveOrderInput = z.infer<typeof moveOrderSchema>;

/**
 * Reordenar dentro de la columna en cola. El destino es la posición base 0
 * que ocupará la tarjeta una vez soltada.
 */
export const reorderQueueSchema = z.object({
  orderId: id,
  targetIndex: z.number().int().min(0),
});

export type ReorderQueueInput = z.infer<typeof reorderQueueSchema>;

export const orderIdSchema = z.object({ orderId: id });

// ── El formulario de pedido (V5) ──────────────────────────────────────────

/**
 * Un identificador opcional. El formulario manda `""` cuando el usuario no
 * eligió nada, y eso es ausencia de dato, no un valor inválido.
 */
const optionalId = z
  .union([id, z.literal(""), z.null()])
  .optional()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  );

/** Un texto opcional vacío es ausencia de dato, no una cadena vacía. */
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  );

/**
 * Fecha civil `YYYY-MM-DD`, la misma forma que guarda `due_date` y que
 * compara `isOverdue`. Deliberadamente sin hora ni zona: la fecha
 * comprometida es un día del calendario del taller, no un instante.
 */
const optionalDueDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  )
  .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "La fecha comprometida no tiene un formato válido",
  });

const optionalDeliveryMode = z
  .union([z.enum(DELIVERY_MODES), z.literal(""), z.null()])
  .optional()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  );

/**
 * Cantidades y precios llegan como texto desde el formulario y como número
 * desde el servidor. `Number("")` es 0, así que un campo vacío cae en la
 * comprobación de "mayor que cero" y recibe el mensaje que corresponde.
 */
const numeric = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? value : Number(value)));

/**
 * Una línea del pedido. El precio se valida aquí y se guarda en la línea:
 * un cambio posterior en el catálogo no puede reescribirlo (esquema §2).
 */
export const orderLineSchema = z
  .object({
    // Generado en el cliente (convención nº 9): el modo sin conexión lo
    // necesita y la edición lo usa para distinguir la línea que ya existía.
    id,
    itemId: optionalId,
    variantId: optionalId,
    description: optionalText,
    quantity: numeric.refine((value) => Number.isFinite(value) && value > 0, {
      message: "La cantidad tiene que ser mayor que cero",
    }),
    unitPrice: numeric.refine((value) => Number.isFinite(value) && value >= 0, {
      message: "El precio no puede ser negativo",
    }),
  })
  // Una línea libre es la salida para lo que no está en el catálogo, pero
  // sin producto ni descripción no dice nada de lo que se pidió.
  .refine((line) => line.itemId !== null || line.description !== null, {
    message: "Una línea sin producto necesita una descripción",
    path: ["description"],
  });

export type OrderLineValues = z.infer<typeof orderLineSchema>;
export type OrderLineInput = z.input<typeof orderLineSchema>;

/**
 * El pedido completo. **No lleva `statusId`**: el estado inicial lo resuelve
 * la base desde el juego de la línea (design.md D3), y `z.object` descarta
 * la clave si alguien la manda.
 *
 * Tampoco lleva total: es un derivado y no se almacena (convención nº 4).
 */
export const orderFormSchema = z.object({
  id,
  businessLineId: z.guid("Elige una línea de negocio"),
  // Un pedido es un compromiso con alguien. La restricción
  // `order_needs_customer` lo garantiza en la base; aquí se avisa antes.
  contactId: z.guid("Elige o crea un cliente"),
  salesChannelId: optionalId,
  deliveryMode: optionalDeliveryMode,
  dueDate: optionalDueDate,
  notes: optionalText,
  /** La hora real del hecho la fija el cliente (convención nº 9). */
  occurredAt: z.string().min(1),
  items: z.array(orderLineSchema).min(1, "Agrega al menos una línea"),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;
export type OrderFormInput = z.input<typeof orderFormSchema>;

/** Archivar un adjunto del pedido. Quitar es archivar, nunca borrar. */
export const orderAttachmentSchema = z.object({
  id,
  orderId: id,
  archived: z.boolean(),
});
