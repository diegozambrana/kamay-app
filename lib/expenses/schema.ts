import { z } from "zod";

/**
 * Validación de las Server Actions de egresos. Vive fuera de `actions/`
 * porque un módulo `"use server"` solo puede exportar funciones asíncronas.
 *
 * Los mismos mínimos que la base garantiza después (`purchase_needs_supplier`,
 * `expense_needs_category_and_amount`, "una compra necesita al menos una
 * línea"), avisados antes de enviar y con el campo señalado.
 */

const id = z.guid();

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
 * Cantidades, precios y montos llegan como texto desde el formulario y como
 * número desde el servidor. `Number("")` es 0, así que un campo vacío cae en
 * la comprobación de "mayor que cero" y recibe el mensaje que corresponde.
 */
const numeric = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === "number" ? value : Number(value)));

/** La hora real del hecho la fija el cliente (convención nº 9). */
const occurredAt = z.string().min(1, "Falta la fecha");

// ── El gasto (V9) ─────────────────────────────────────────────────────────

export const costFormSchema = z.object({
  // Generado en el cliente (convención nº 9).
  id,
  businessLineId: z.guid("Elige una línea de negocio"),
  expenseCategoryId: z.guid("Elige una categoría"),
  amount: numeric.refine((value) => Number.isFinite(value) && value > 0, {
    message: "Escribe el monto",
  }),
  occurredAt,
  note: optionalText,
  /** "Asignar a un pedido": opcional y plegado por defecto. */
  orderId: optionalId,
});

export type CostFormValues = z.infer<typeof costFormSchema>;
export type CostFormInput = z.input<typeof costFormSchema>;

// ── La compra (V8) ────────────────────────────────────────────────────────

export const purchaseLineSchema = z.object({
  id,
  itemId: z.guid("Elige un insumo"),
  variantId: optionalId,
  quantity: numeric.refine((value) => Number.isFinite(value) && value > 0, {
    message: "La cantidad tiene que ser mayor que cero",
  }),
  unitPrice: numeric.refine((value) => Number.isFinite(value) && value >= 0, {
    message: "El precio no puede ser negativo",
  }),
});

export type PurchaseLineValues = z.infer<typeof purchaseLineSchema>;
export type PurchaseLineInput = z.input<typeof purchaseLineSchema>;

export const purchaseFormSchema = z.object({
  id,
  businessLineId: z.guid("Elige una línea de negocio"),
  // Una compra siempre tiene a quién se le compró. La restricción
  // `purchase_needs_supplier` lo garantiza en la base; aquí se avisa antes.
  contactId: z.guid("Elige o crea un proveedor"),
  occurredAt,
  note: optionalText,
  items: z.array(purchaseLineSchema).min(1, "Agrega al menos un insumo"),
});

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;
export type PurchaseFormInput = z.input<typeof purchaseFormSchema>;

// ── Lo demás ──────────────────────────────────────────────────────────────

export const expenseIdSchema = z.object({ expenseId: id });

/** Quitar un comprobante es archivarlo, nunca borrarlo. */
export const receiptArchiveSchema = z.object({
  id,
  expenseId: id,
  archived: z.boolean(),
});
