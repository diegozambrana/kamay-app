import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExpenseItem } from "@/types";

type ExpenseItemRow = {
  id: string;
  organization_id: string;
  expense_id: string;
  item_id: string;
  variant_id: string | null;
  quantity: number | string;
  unit_price: number | string;
};

const COLUMNS =
  "id, organization_id, expense_id, item_id, variant_id, quantity, unit_price";

/** Una línea con lo que el detalle necesita mostrar sin más consultas. */
export type ExpenseItemWithNames = ExpenseItem & {
  itemName: string | null;
  variantName: string | null;
  /** `quantity * unitPrice`. Derivado al vuelo; nunca se guarda. */
  lineTotal: number;
};

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Acceso a `expense_items`. El precio de la línea es el que se pagó: este
 * servicio nunca lo relee del catálogo, porque un cambio de precio no puede
 * reescribir la historia (esquema §2).
 */
export class ExpenseItemService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByExpense(
    organizationId: string,
    expenseId: string,
  ): Promise<ExpenseItemWithNames[]> {
    const { data, error } = await this.supabase
      .from("expense_items")
      // El nombre del ítem y de la variante se traen resueltos para que el
      // detalle no dispare una consulta por línea.
      .select(`${COLUMNS}, items(name), item_variants(name)`)
      .eq("organization_id", organizationId)
      .eq("expense_id", expenseId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`No se pudieron cargar los insumos: ${error.message}`);
    }

    return (data ?? []).map((raw) => {
      const row = raw as unknown as ExpenseItemRow & {
        items: { name: string } | null;
        item_variants: { name: string } | null;
      };

      const quantity = toNumber(row.quantity);
      const unitPrice = toNumber(row.unit_price);

      return {
        id: row.id,
        organizationId: row.organization_id,
        expenseId: row.expense_id,
        itemId: row.item_id,
        variantId: row.variant_id,
        quantity,
        unitPrice,
        itemName: row.items?.name ?? null,
        variantName: row.item_variants?.name ?? null,
        lineTotal: quantity * unitPrice,
      };
    });
  }
}
