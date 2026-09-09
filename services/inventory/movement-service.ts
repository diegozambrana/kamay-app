import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConsumptionValues, CountValues } from "@/lib/inventory/schema";
import type { InventoryMovement, ItemBalance } from "@/types";

type MovementRow = {
  id: string;
  organization_id: string;
  item_id: string;
  variant_id: string | null;
  kind: string;
  quantity: number | string;
  source_type: string | null;
  source_id: string | null;
  occurred_at: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

type BalanceRow = {
  item_id: string;
  organization_id: string;
  balance: number | string;
  min_stock: number | string | null;
  below_min: boolean;
};

const COLUMNS =
  "id, organization_id, item_id, variant_id, kind, quantity, source_type, source_id, occurred_at, note, created_by, created_at";

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function movementFromRow(row: MovementRow): InventoryMovement {
  return {
    id: row.id,
    organizationId: row.organization_id,
    itemId: row.item_id,
    variantId: row.variant_id,
    kind: row.kind as InventoryMovement["kind"],
    quantity: toNumber(row.quantity),
    sourceType: row.source_type as InventoryMovement["sourceType"],
    sourceId: row.source_id,
    occurredAt: row.occurred_at,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function balanceFromRow(row: BalanceRow): ItemBalance {
  return {
    itemId: row.item_id,
    organizationId: row.organization_id,
    balance: toNumber(row.balance),
    minStock: toNullableNumber(row.min_stock),
    belowMin: row.below_min,
  };
}

/**
 * Acceso a `inventory_movements` y a `item_balances`. Ninguna consulta a
 * Supabase vive fuera de aquí, y todas filtran por `organization_id`
 * explícitamente aunque RLS ya lo haga (convención nº 2).
 *
 * No hay método de edición ni de archivado, y su ausencia es deliberada: el
 * documento es inmutable y la base ni siquiera concede el privilegio. Una
 * corrección es un `registerCountAdjustment` más.
 */
export class MovementService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Un consumo. Siempre `manual`, venga del ítem, del pedido o de la tarea
   * (design D5): el origen `order_item` limitaría a un movimiento por línea de
   * pedido, y consumir varios insumos para la misma línea es lo normal. La
   * referencia al pedido viaja en la nota.
   *
   * El formulario pide una cantidad positiva —«consumí 5»—; el signo lo pone
   * aquí, porque es la base la que exige que una salida sea negativa.
   */
  async registerConsumption(
    organizationId: string,
    values: ConsumptionValues,
  ): Promise<void> {
    const { error } = await this.supabase.from("inventory_movements").insert({
      id: values.id,
      organization_id: organizationId,
      item_id: values.itemId,
      variant_id: values.variantId,
      kind: "out",
      quantity: -Math.abs(values.quantity),
      source_type: "manual",
      occurred_at: values.occurredAt,
      note: values.note,
    });

    if (error) throw error;
  }

  /**
   * Un ajuste por conteo. La diferencia llega calculada por el diálogo
   * (design D6) y aquí se guarda tal cual: recalcularla contra el saldo del
   * momento de llegada borraría lo que ocurriera entre el conteo y su
   * sincronización.
   */
  async registerCountAdjustment(
    organizationId: string,
    values: CountValues,
  ): Promise<void> {
    const { error } = await this.supabase.from("inventory_movements").insert({
      id: values.id,
      organization_id: organizationId,
      item_id: values.itemId,
      variant_id: values.variantId,
      kind: "adjustment",
      quantity: values.difference,
      source_type: "count",
      occurred_at: values.occurredAt,
      note: values.note,
    });

    if (error) throw error;
  }

  /**
   * Los saldos de la organización.
   *
   * Consulta plana a propósito: `item_balances` es una vista agregada y
   * PostgREST **no puede embeber `items` desde ella** —no hay relación de
   * clave foránea que descubrir—, así que pedir la línea aquí devolvería
   * `PGRST200`. El recorte por línea y por archivado lo hace
   * `scopedToLine`, que es puro y se prueba sin base de datos.
   */
  async balances(
    organizationId: string,
    options: { belowMinOnly?: boolean } = {},
  ): Promise<ItemBalance[]> {
    let query = this.supabase
      .from("item_balances")
      .select("item_id, organization_id, balance, min_stock, below_min")
      .eq("organization_id", organizationId);

    if (options.belowMinOnly) query = query.eq("below_min", true);

    const { data, error } = await query;
    if (error) {
      throw new Error(`No se pudieron cargar los saldos: ${error.message}`);
    }

    return (data ?? []).map((row) => balanceFromRow(row as unknown as BalanceRow));
  }

  /** El saldo de un solo ítem. `null` si no es un insumo: solo ellos lo tienen. */
  async balanceFor(organizationId: string, itemId: string): Promise<ItemBalance | null> {
    const { data, error } = await this.supabase
      .from("item_balances")
      .select("item_id, organization_id, balance, min_stock, below_min")
      .eq("organization_id", organizationId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo cargar el saldo: ${error.message}`);
    }

    return data ? balanceFromRow(data as unknown as BalanceRow) : null;
  }

  /**
   * Los movimientos de un ítem, del más reciente al más antiguo por la hora
   * del hecho.
   *
   * Paginada desde el primer día: un insumo muy usado acumula miles de filas
   * al año (§Volumen esperado) y la sección del detalle carga una página, no
   * el historial entero. El índice `(item_id, occurred_at desc)` la sostiene.
   */
  async forItem(
    organizationId: string,
    itemId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<InventoryMovement[]> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    const { data, error } = await this.supabase
      .from("inventory_movements")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("item_id", itemId)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`No se pudieron cargar los movimientos: ${error.message}`);
    }

    return (data ?? []).map((row) => movementFromRow(row as unknown as MovementRow));
  }
}
