import { z } from "zod";

/**
 * Validación de las Server Actions de activos. Vive fuera de `actions/`
 * porque un módulo `"use server"` solo puede exportar funciones asíncronas.
 *
 * Los mismos mínimos que la base garantiza después —costo no negativo, activo
 * y papel declarados juntos— avisados antes de enviar y con el campo señalado.
 */

const id = z.guid();

const optionalId = z
  .union([id, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === undefined || value === null || value === "" ? null : value));

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) => (value === undefined || value === null || value === "" ? null : value));

export const assetDetailsSchema = z.object({
  itemId: id,
  acquisitionCost: z.coerce
    .number({ error: "Escribe cuánto costó." })
    .nonnegative("El costo no puede ser negativo."),
  // `date` y no `datetime`: la fecha de compra es un día del calendario del
  // taller, no un instante. La hora no aporta nada y complicaría el corte.
  acquiredOn: z.iso.date("Elige la fecha de compra."),
  supplierId: optionalId,
  notes: optionalText,
  /**
   * El egreso con el que se compró, cuando el activo nace de una compra. Al
   * guardarlo queda marcado como la adquisición del activo: es lo que permite
   * excluir ese pago del margen con el que el activo se mide, sin lo cual la
   * máquina tendría que generar dos veces su costo.
   */
  acquisitionExpenseId: optionalId,
});

export type AssetDetailsValues = z.infer<typeof assetDetailsSchema>;

/**
 * Vincular un egreso a un activo, o deshacer el vínculo.
 *
 * `assetId` nulo con `role` nulo es la desvinculación: los dos van juntos,
 * igual que en la base. El papel `acquisition` no se ofrece aquí —lo declara
 * el alta desde la compra— pero se acepta, porque es el mismo camino de
 * escritura y prohibirlo dos veces no lo hace más cierto.
 */
export const assetExpenseLinkSchema = z.object({
  expenseId: id,
  assetId: optionalId,
  role: z.enum(["acquisition", "maintenance"]).nullish().default(null),
});

export type AssetExpenseLinkValues = z.infer<typeof assetExpenseLinkSchema>;
