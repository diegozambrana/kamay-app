import { z } from "zod";

import { PAYMENT_METHODS } from "@/types";

/**
 * Validación de la venta directa (KAM-12). Vive fuera de `actions/` porque un
 * módulo `"use server"` solo puede exportar funciones asíncronas.
 *
 * El servidor no confía en el formulario: la Server Action valida esto antes
 * de llamar a `create_direct_sale`, y la base vuelve a comprobar lo suyo.
 */

const id = z.guid();

/** Una línea de la venta. Sin líneas no hay venta que registrar. */
export const directSaleLineSchema = z.object({
  /** `uuid` de cliente: es lo que hace idempotente el reenvío de la cola. */
  id,
  itemId: id.nullable(),
  variantId: id.nullable(),
  description: z.string().trim().max(500).nullable(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

/**
 * El cobro de la venta. `null` registra la venta sin cobro — el caso raro, no
 * el imposible. Un monto de cero es lo mismo que no cobrar; uno negativo es
 * una llamada equivocada y se rechaza aquí antes de llegar a la base.
 */
export const directSalePaymentSchema = z.object({
  id,
  amount: z.number().min(0),
  method: z.enum(PAYMENT_METHODS),
});

export const directSaleSchema = z.object({
  id,
  organizationId: id,
  businessLineId: id,
  contactId: id.nullable(),
  salesChannelId: id.nullable(),
  /** La hora real del hecho, fijada por el cliente (convención nº 9). */
  occurredAt: z.iso.datetime(),
  notes: z.string().trim().max(1000).nullable(),
  items: z.array(directSaleLineSchema).min(1),
  payment: directSalePaymentSchema.nullable(),
});

export type DirectSaleLineInput = z.infer<typeof directSaleLineSchema>;
export type DirectSalePaymentInput = z.infer<typeof directSalePaymentSchema>;
export type DirectSaleInput = z.infer<typeof directSaleSchema>;
