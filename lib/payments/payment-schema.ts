import { z } from "zod";

import { PAYMENT_METHODS } from "@/types";

/**
 * Validación de las Server Actions de cobros y pagos. Vive fuera de
 * `actions/` porque un módulo `"use server"` solo puede exportar funciones
 * asíncronas.
 *
 * Repite los mínimos que la base garantiza después (`amount > 0`, el dominio
 * de `method`, el destino único) para poder señalar el campo antes de enviar.
 * La garantía sigue siendo la de la base: esto es el mensaje, no la regla.
 */

const id = z.guid();

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
 * El monto llega como texto desde el formulario y como número desde el
 * servidor. `Number("")` es 0, así que un campo vacío cae en la comprobación
 * de "mayor que cero" y recibe el mensaje que corresponde.
 */
const amount = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? value : Number(value)))
  .refine((value) => Number.isFinite(value) && value > 0, {
    message: "Escribe un monto mayor que cero",
  });

/** El método es opcional: un cobro puede registrarse sin declararlo. */
const method = z
  .union([z.enum(PAYMENT_METHODS), z.literal(""), z.null()])
  .optional()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  );

/** La hora real del hecho la fija el cliente (convención nº 9). */
const occurredAt = z.string().min(1, "Falta la fecha");

/** Lo común a cobrar y pagar: el destino lo pone cada esquema. */
const movement = {
  // Generado en el cliente (convención nº 9, modo sin conexión).
  id,
  amount,
  method,
  occurredAt,
  note: optionalText,
};

/** Registrar un cobro contra un pedido. La dirección es siempre `in`. */
export const collectionSchema = z.object({
  ...movement,
  orderId: z.guid("Falta el pedido"),
});

/** Registrar un pago contra un egreso. La dirección es siempre `out`. */
export const paymentSchema = z.object({
  ...movement,
  expenseId: z.guid("Falta el egreso"),
});

/** Anular: el identificador del movimiento y nada más. */
export const voidPaymentSchema = z.object({ id });

export type CollectionValues = z.infer<typeof collectionSchema>;
export type PaymentValues = z.infer<typeof paymentSchema>;
