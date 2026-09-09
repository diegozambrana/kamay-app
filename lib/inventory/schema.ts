import { z } from "zod";

/**
 * Validación de las Server Actions de inventario. Vive fuera de `actions/`
 * porque un módulo `"use server"` solo puede exportar funciones asíncronas.
 *
 * Los mismos mínimos que la base garantiza después (`quantity <> 0`,
 * `sign_matches_kind`), avisados antes de enviar y con el campo señalado.
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

const optionalId = z
  .union([id, z.literal(""), z.null()])
  .optional()
  .transform((value) =>
    value === undefined || value === null || value === "" ? null : value,
  );

/**
 * Las cantidades llegan como texto desde el formulario y como número desde el
 * servidor. `Number("")` es 0, así que un campo vacío cae en la comprobación
 * que corresponde y recibe su mensaje.
 */
const numeric = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? value : Number(value)));

/** La hora real del hecho la fija el cliente (convención nº 9). */
const occurredAt = z.string().min(1, "Falta la fecha");

// ── Consumo ───────────────────────────────────────────────────────────────

export const consumptionSchema = z.object({
  /** Generado en el cliente (convención nº 9): el reintento reenvía el mismo. */
  id,
  itemId: z.guid("Elige un insumo"),
  variantId: optionalId,
  quantity: numeric.refine((value) => Number.isFinite(value) && value > 0, {
    message: "La cantidad tiene que ser mayor que cero",
  }),
  occurredAt,
  note: optionalText,
});

export type ConsumptionValues = z.infer<typeof consumptionSchema>;

// ── Ajuste por conteo ─────────────────────────────────────────────────────

/**
 * El conteo pregunta **cuánto hay**; lo que viaja es la **diferencia**, ya
 * calculada por el diálogo con `countAdjustment` (design D6).
 *
 * No es un detalle de implementación: es lo que hace correcto un ajuste que
 * llega tarde. Si el servidor recalculara la diferencia contra el saldo del
 * momento de llegada, un consumo registrado entre el conteo y su
 * sincronización desaparecería sin dejar rastro.
 *
 * No hay campo de motivo, y su ausencia es la funcionalidad: pedir una
 * justificación es la forma más segura de que nadie ajuste y el saldo se aleje
 * para siempre de la realidad (criterio nº 4 del backlog).
 */
export const countSchema = z.object({
  id,
  itemId: z.guid("Elige un insumo"),
  variantId: optionalId,
  /**
   * Con signo, y nunca cero: un conteo que coincide con el saldo no produce
   * movimiento, y el diálogo lo dice en vez de intentar guardarlo.
   */
  difference: numeric.refine(
    (value) => Number.isFinite(value) && value !== 0,
    { message: "El conteo coincide con el saldo: no hay nada que ajustar" },
  ),
  occurredAt,
  note: optionalText,
});

export type CountValues = z.infer<typeof countSchema>;
