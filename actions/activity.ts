"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { setItemArchived } from "@/actions/catalog";
import { unarchiveConfigurationItem } from "@/actions/configuration";
import { setContactArchived } from "@/actions/contacts";
import { unarchiveExpense } from "@/actions/expenses";
import { unarchiveOrder } from "@/actions/orders";
import { type UnarchivableTable, isUnarchivable } from "@/lib/activity/unarchive";

type ActionResult = { error?: string } | void;

const unarchiveSchema = z.object({
  tableName: z.string().min(1),
  recordId: z.uuid("No se pudo identificar el registro."),
});

/**
 * Qué tablas se pueden desarchivar desde su evento, y por dónde.
 *
 * **Se delega en la acción de cada dominio**, nunca en un
 * `update archived_at = null` genérico: cada una lleva sus validaciones, su
 * guardia de rol y su `revalidatePath`, y saltárselas para que un botón
 * funcione desde aquí sería construir una puerta trasera al modelo.
 *
 * Lo que no está en este mapa no ofrece la acción. Hoy faltan `tasks` —cuyo
 * servicio tiene `archive()` pero no su inverso—, `item_variants` —cuya acción
 * exige también el `item_id`, que el evento no guarda: el mismo caso que los
 * activos de design D14— y todas las tablas cuyo archivado no tiene sentido
 * por sí solo, como las líneas de un pedido.
 */
const UNARCHIVERS: Record<
  UnarchivableTable,
  (id: string) => Promise<ActionResult>
> = {
  orders: (orderId) => unarchiveOrder({ orderId }),
  expenses: (expenseId) => unarchiveExpense({ expenseId }),
  contacts: (id) => setContactArchived({ id, archived: false }),
  items: (id) => setItemArchived({ id, archived: false }),
  business_lines: (id) => unarchiveConfigurationItem({ entity: "line", id }),
  sales_channels: (id) => unarchiveConfigurationItem({ entity: "channel", id }),
  expense_categories: (id) =>
    unarchiveConfigurationItem({ entity: "category", id }),
  units: (id) => unarchiveConfigurationItem({ entity: "unit", id }),
};

/**
 * Desarchivar desde el evento de archivado (V23).
 *
 * El desarchivado **queda registrado a su vez**: el trigger de KAM-03 detecta
 * que `archived_at` vuelve a null y escribe un evento `unarchived`. No hace
 * falta escribirlo aquí, y no se escribe: la bitácora se llena sola o no se
 * llena.
 */
export async function unarchiveFromEvent(
  input: z.infer<typeof unarchiveSchema>,
): Promise<ActionResult> {
  const parsed = unarchiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (!isUnarchivable(parsed.data.tableName)) {
    return { error: "Este registro no se puede desarchivar desde la bitácora." };
  }

  const result = await UNARCHIVERS[parsed.data.tableName](parsed.data.recordId);
  if (result?.error) return result;

  revalidatePath("/activity");
}
