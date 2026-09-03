import type { SupabaseClient } from "@supabase/supabase-js";

/** El último costo conocido de un ítem, tal como lo expone `item_last_cost`. */
export type ItemLastCost = {
  itemId: string;
  lastCost: number;
  lastPurchaseAt: string;
  lastSupplierId: string | null;
};

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Acceso a la vista `item_last_cost`. Es una vista con `security_invoker`
 * sobre `expense_items`: al ayudante le devuelve cero filas por RLS, sin que
 * este servicio tenga que saberlo (esquema §16).
 */
export class ItemLastCostService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Todos los últimos costos de la organización de una vez: el formulario de
   * compra los necesita para cualquier insumo que se agregue, y el catálogo
   * de un taller cabe en una consulta (design D3).
   */
  async mapFor(organizationId: string): Promise<Map<string, ItemLastCost>> {
    const { data, error } = await this.supabase
      .from("item_last_cost")
      .select("item_id, last_cost, last_purchase_at, last_supplier_id")
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudieron cargar los últimos costos: ${error.message}`);
    }

    const map = new Map<string, ItemLastCost>();
    for (const raw of data ?? []) {
      const row = raw as unknown as {
        item_id: string;
        last_cost: number | string;
        last_purchase_at: string;
        last_supplier_id: string | null;
      };
      map.set(row.item_id, {
        itemId: row.item_id,
        lastCost: toNumber(row.last_cost),
        lastPurchaseAt: row.last_purchase_at,
        lastSupplierId: row.last_supplier_id,
      });
    }
    return map;
  }
}
