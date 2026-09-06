import type { SupabaseClient } from "@supabase/supabase-js";

import { RECENT_LIMIT, type RecentCapture } from "@/lib/quick-capture/recent";

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
 * Dos consultas acotadas en vez de una vista: con dos orígenes el
 * sobre-consumo es de cinco filas y la mezcla es pura y probable, y este
 * cambio no toca el esquema (design D3, que fija cuándo deja de bastar).
 */
export class RecentCaptureService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * @param today "Hoy" en la zona de la organización, como `YYYY-MM-DD`.
   */
  async listToday(organizationId: string, today: string): Promise<RecentCapture[]> {
    const from = `${today}T00:00:00`;
    const to = `${today}T23:59:59.999`;

    const [orders, expenses] = await Promise.all([
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
    ]);

    return [
      ...((orders.data ?? []) as OrderRow[]).map(toOrderCapture),
      ...((expenses.data ?? []) as ExpenseRow[]).map(toExpenseCapture),
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
