import type { SupabaseClient } from "@supabase/supabase-js";

import type { CashFlow } from "@/lib/dashboard/indicators";
import type { DeliveryMode, StatusKind } from "@/types";

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** La caja de un mes, ya repartida por línea. */
export type MonthCashFlow = {
  /** El agregado de la línea activa, o de todas si no hay ninguna. */
  total: CashFlow;
  /** Una entrada por línea con movimiento en el mes. */
  byLine: Map<string, CashFlow>;
};

/** Un pedido que vence pronto, tal como lo necesita la tarjeta. */
export type UpcomingDelivery = {
  id: string;
  code: number;
  businessLineId: string;
  contactId: string | null;
  statusId: string;
  deliveryMode: DeliveryMode | null;
  dueDate: string;
  /** El tipo declarado del estado. Quién lo interpreta es `isOverdue`. */
  statusKind: StatusKind;
};

/**
 * Los tipos de estado en los que una entrega sigue pendiente. Un pedido
 * `final` ya se entregó y uno `cancelled` no se va a entregar: ninguno de los
 * dos es una entrega próxima.
 */
const PENDING_KINDS: StatusKind[] = ["initial", "in_progress", "waiting"];

type DeliveryRow = {
  id: string;
  code: number;
  business_line_id: string;
  contact_id: string | null;
  status_id: string;
  delivery_mode: string | null;
  due_date: string;
  kind: string;
};

/**
 * Lectura del panel (V2). Ninguna consulta a Supabase vive fuera de aquí, y
 * todas filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2).
 *
 * Ninguna cifra se calcula aquí que la base pueda calcular: la caja del mes
 * la agrega `cash_flow_by_line_month` y el saldo por cobrar,
 * `receivables_by_line`. Este servicio pide y reparte; las cuentas puras
 * viven en `lib/dashboard/indicators.ts` y la decisión de retraso, en
 * `lib/orders/overdue.ts`.
 */
export class DashboardService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * La caja del mes: el agregado de la línea activa y el desglose por línea,
   * en una sola consulta.
   *
   * Se piden todas las líneas del mes aunque haya una activa —el comparativo
   * las necesita todas— y el recorte de la línea activa se hace al repartir.
   * Una segunda consulta filtrada por línea traería exactamente las mismas
   * filas.
   *
   * Al ayudante esta vista le devuelve cero filas por su propia condición
   * `is_owner` (design D4), así que aquí no hay ni una línea de lógica de
   * permisos. Aun así, la composición del ayudante no llama a este método:
   * no se piden datos que ese rol no debe recibir (design D5).
   */
  async cashFlowForMonth(
    organizationId: string,
    monthStart: string,
    businessLineId: string | null,
  ): Promise<MonthCashFlow> {
    const { data, error } = await this.supabase
      .from("cash_flow_by_line_month")
      .select("business_line_id, collected, paid")
      .eq("organization_id", organizationId)
      .eq("month", monthStart);

    if (error) {
      throw new Error(`No se pudo calcular la caja del mes: ${error.message}`);
    }

    const byLine = new Map<string, CashFlow>();
    let collected = 0;
    let paid = 0;

    for (const row of (data ?? []) as {
      business_line_id: string;
      collected: number | string;
      paid: number | string;
    }[]) {
      const flow = {
        collected: toNumber(row.collected),
        paid: toNumber(row.paid),
      };
      byLine.set(row.business_line_id, flow);

      // El agregado respeta la línea activa; el desglose, nunca: el
      // comparativo muestra las tres aunque el selector tenga una elegida.
      if (!businessLineId || businessLineId === row.business_line_id) {
        collected += flow.collected;
        paid += flow.paid;
      }
    }

    return { total: { collected, paid }, byLine };
  }

  /**
   * Los pedidos que vencen dentro de la ventana o ya vencieron.
   *
   * Solo entra lo que **sigue comprometido**: los estados de tipo `initial`,
   * `in_progress` y `waiting`. Un pedido entregado o cancelado ya no es una
   * entrega próxima, y sin este recorte la lista se llena de pedidos
   * terminados hace meses —ordenados por fecha, los más antiguos primero—
   * hasta desplazar a los que sí siguen pendientes.
   *
   * Lo que sí entra por antiguo que sea es un compromiso atascado: un pedido
   * en curso vencido hace tres meses encabeza la lista, que es exactamente lo
   * que esta tarjeta existe para no dejar olvidar. Por eso el recorte es por
   * estado y no por una ventana hacia atrás.
   *
   * Trae el `kind` del estado y no decide con él quién está *retrasado*: eso
   * lo dice `isOverdue`, la única definición de retraso del proyecto (design
   * D7). Un pedido sin `due_date` no entra —no hay nada comprometido que
   * pueda vencer— y las ventas directas tampoco: no recorren ningún ciclo de
   * entrega.
   */
  async upcomingDeliveries(
    organizationId: string,
    businessLineId: string | null,
    horizon: string,
    limit = 8,
  ): Promise<UpcomingDelivery[]> {
    let query = this.supabase
      .from("orders")
      .select(
        "id, code, business_line_id, contact_id, status_id, delivery_mode, due_date, statuses!inner(kind)",
      )
      .eq("organization_id", organizationId)
      .eq("kind", "order")
      .is("archived_at", null)
      .not("due_date", "is", null)
      .lte("due_date", horizon)
      // Por `kind` y nunca por nombre: los nombres los configura cada
      // organización por línea (convención nº 5).
      .in("statuses.kind", PENDING_KINDS);

    if (businessLineId) query = query.eq("business_line_id", businessLineId);

    const { data, error } = await query
      .order("due_date", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(
        `No se pudieron cargar las entregas próximas: ${error.message}`,
      );
    }

    return (data ?? []).map((raw) => {
      const row = raw as unknown as DeliveryRow & {
        statuses: { kind: string } | { kind: string }[];
      };
      const status = Array.isArray(row.statuses) ? row.statuses[0] : row.statuses;

      return {
        id: row.id,
        code: row.code,
        businessLineId: row.business_line_id,
        contactId: row.contact_id,
        statusId: row.status_id,
        deliveryMode: (row.delivery_mode as DeliveryMode | null) ?? null,
        dueDate: row.due_date,
        statusKind: (status?.kind as StatusKind | undefined) ?? "in_progress",
      };
    });
  }
}
