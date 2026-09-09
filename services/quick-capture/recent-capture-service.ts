import type { SupabaseClient } from "@supabase/supabase-js";

import {
  RECENT_LIMIT,
  dayBoundsInTimezone,
  type RecentCapture,
} from "@/lib/quick-capture/recent";

type OrderRow = {
  id: string;
  kind: string;
  code: number | null;
  business_line_id: string | null;
  occurred_at: string;
};

type ExpenseRow = {
  id: string;
  kind: string;
  business_line_id: string | null;
  amount: number | string | null;
  occurred_at: string;
};

/**
 * Lo registrado hoy en la organización, según el servidor.
 *
 * Es la mitad sincronizada de la lista de V16; la pendiente la aporta el
 * cliente desde la cola (design D3b). No hay ninguna comprobación de rol
 * aquí: RLS ya recorta —el ayudante no lee `expenses` y recibe cero filas—,
 * y duplicar la regla en el servicio sería una segunda verdad que mantener.
 *
 * Tres consultas acotadas en vez de una vista: con tres orígenes el
 * sobre-consumo sigue siendo de cinco filas por origen y la mezcla es pura y
 * probable, y esto no toca el esquema (design D3 de KAM-13, que fija cuándo
 * deja de bastar).
 */
type ConsumptionRow = {
  id: string;
  item_id: string;
  quantity: number | string;
  note: string | null;
  occurred_at: string;
};

export class RecentCaptureService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * @param today "Hoy" en la zona de la organización, como `YYYY-MM-DD`.
   * @param timezone La zona de la organización, que es la que define ese día.
   */
  async listToday(
    organizationId: string,
    today: string,
    timezone: string,
  ): Promise<RecentCapture[]> {
    // Los extremos llevan su desplazamiento: `occurred_at` es `timestamptz` y
    // un literal sin offset lo interpretaría la base en UTC, acotando el día
    // equivocado (ver `dayBoundsInTimezone`).
    const { from, to } = dayBoundsInTimezone(today, timezone);

    const [orders, expenses, consumptions] = await Promise.all([
      this.supabase
        .from("orders")
        .select("id, kind, code, business_line_id, occurred_at")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: false })
        .limit(RECENT_LIMIT),
      this.supabase
        .from("expenses")
        .select("id, kind, business_line_id, amount, occurred_at")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: false })
        .limit(RECENT_LIMIT),
      // Los consumos del día (KAM-18). Solo los `manual`: las entradas de
      // compra ya aparecen como su compra, y un ajuste por conteo no es una
      // captura del día sino una corrección del saldo.
      this.supabase
        .from("inventory_movements")
        .select("id, item_id, quantity, note, occurred_at")
        .eq("organization_id", organizationId)
        .eq("source_type", "manual")
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: false })
        .limit(RECENT_LIMIT),
    ]);

    return [
      ...((orders.data ?? []) as OrderRow[]).map(toOrderCapture),
      ...((expenses.data ?? []) as ExpenseRow[]).map(toExpenseCapture),
      ...((consumptions.data ?? []) as ConsumptionRow[]).map(toConsumptionCapture),
    ];
  }
}

/** Una venta directa no es un pedido: no tiene ciclo ni número de encargo. */
function toOrderCapture(row: OrderRow): RecentCapture {
  const isSale = row.kind === "direct_sale";

  return {
    kind: isSale ? "direct-sale" : "order",
    id: row.id,
    label: isSale ? "Venta rápida" : `Pedido #${row.code ?? "—"}`,
    lineId: row.business_line_id,
    occurredAt: row.occurred_at,
    // Una venta directa no aparece en el tablero, pero sí tiene detalle.
    href: `/orders/${row.id}`,
    pending: false,
  };
}

/**
 * Un consumo registrado hoy.
 *
 * `lineId` va nulo a propósito: el movimiento no tiene línea propia —la tiene
 * el ítem—, y adivinarla aquí obligaría a una consulta más por fila. La lista
 * de V16 no filtra por línea, así que no hace falta.
 *
 * Lleva al detalle del insumo, que es donde están su saldo y sus movimientos.
 */
function toConsumptionCapture(row: ConsumptionRow): RecentCapture {
  const quantity = typeof row.quantity === "number" ? row.quantity : Number(row.quantity);

  return {
    kind: "consumption",
    id: row.id,
    label: row.note ? `Consumo · ${row.note}` : `Consumo de ${Math.abs(quantity)}`,
    lineId: null,
    occurredAt: row.occurred_at,
    href: `/catalog/${row.item_id}`,
    pending: false,
  };
}

function toExpenseCapture(row: ExpenseRow): RecentCapture {
  const isPurchase = row.kind === "purchase";

  return {
    kind: isPurchase ? "purchase" : "cost",
    id: row.id,
    label: isPurchase ? "Compra" : "Gasto",
    lineId: row.business_line_id,
    occurredAt: row.occurred_at,
    href: `/expenses/${row.id}`,
    pending: false,
  };
}
