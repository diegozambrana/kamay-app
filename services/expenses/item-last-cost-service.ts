import type { SupabaseClient } from "@supabase/supabase-js";

import type { PurchasePrice } from "@/features/inventory/price-history-section";

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
  /**
   * Los precios pagados por un insumo, del más reciente al más antiguo por la
   * fecha del hecho. Alimenta la sección *Evolución de precios* de V11
   * (KAM-18).
   *
   * Al ayudante le devuelve **cero filas** sin una línea de código de
   * aplicación: la consulta pasa por `expenses`, tabla sin política de lectura
   * para él (esquema §16). Ese vacío es lo que hace que el servidor componga
   * la página sin la sección, en vez de esconderla en el cliente.
   *
   * Las compras archivadas no cuentan, igual que en `item_last_cost`.
   */
  async pricesFor(
    organizationId: string,
    itemId: string,
    limit = 12,
  ): Promise<PurchasePrice[]> {
    const { data, error } = await this.supabase
      .from("expense_items")
      .select(
        "unit_price, expenses!inner(id, occurred_at, archived_at, kind, contacts(name))",
      )
      .eq("organization_id", organizationId)
      .eq("item_id", itemId)
      .eq("expenses.kind", "purchase")
      .is("expenses.archived_at", null)
      .order("occurred_at", { referencedTable: "expenses", ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`No se pudieron cargar los precios: ${error.message}`);
    }

    return (data ?? []).map((raw) => {
      const row = raw as unknown as {
        unit_price: number | string;
        expenses: {
          id: string;
          occurred_at: string;
          contacts: { name: string } | null;
        };
      };
      return {
        expenseId: row.expenses.id,
        unitPrice: toNumber(row.unit_price),
        occurredAt: row.expenses.occurred_at,
        supplierName: row.expenses.contacts?.name ?? null,
      };
    });
  }
}
