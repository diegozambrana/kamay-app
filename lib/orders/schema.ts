import { z } from "zod";

/**
 * Validación de las Server Actions de pedidos. Vive fuera de `actions/`
 * porque un módulo `"use server"` solo puede exportar funciones asíncronas.
 *
 * En KAM-07 los pedidos entran por semilla: aquí solo se valida lo que el
 * tablero y el detalle escriben — mover de estado, reordenar la cola y
 * archivar. El esquema del alta llega con KAM-08.
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
