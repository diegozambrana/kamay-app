import type { SupabaseClient } from "@supabase/supabase-js";

import type { CollectionValues, PaymentValues } from "@/lib/payments/payment-schema";
import type { OutstandingByLine, Payment, PaymentMethod } from "@/types";

type PaymentRow = {
  id: string;
  organization_id: string;
  direction: string;
  order_id: string | null;
  expense_id: string | null;
  amount: number | string;
  method: string | null;
  occurred_at: string;
  note: string | null;
  created_by: string | null;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, direction, order_id, expense_id, amount, method, " +
  "occurred_at, note, created_by, archived_at";

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Lo cobrado y lo pagado, tal como llegan de las vistas de totales. */
export type DocumentPaid = { total: number; paid: number };

/**
 * Acceso a `payments`. Ninguna consulta a Supabase vive fuera de aquí, y
 * todas filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2).
 *
 * Este servicio solo pide: quién puede cobrar y quién pagar lo decide la
 * política de `payments` —la única del proyecto con permiso partido—, y quién
 * anula, `enforce_archive_rules`. Ningún saldo se calcula aquí: `paid` viene
 * de la vista y el saldo, de `lib/payments/balance.ts`.
 */
export class PaymentService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: PaymentRow): Payment {
    return {
      id: row.id,
      organizationId: row.organization_id,
      direction: row.direction === "out" ? "out" : "in",
      orderId: row.order_id,
      expenseId: row.expense_id,
      amount: toNumber(row.amount),
      method: (row.method as PaymentMethod | null) ?? null,
      occurredAt: row.occurred_at,
      note: row.note,
      createdBy: row.created_by,
      archivedAt: row.archived_at,
    };
  }

  /**
   * Los movimientos de un documento, del más reciente al más antiguo.
   *
   * Los archivados se devuelven también: el bloque de cobros los muestra
   * tachados, porque un movimiento anulado sigue siendo parte de lo que
   * pasó. Lo que no hacen es contar en `paid`, y de eso se ocupa la vista.
   */
  async listForOrder(organizationId: string, orderId: string): Promise<Payment[]> {
    return this.listBy(organizationId, "order_id", orderId);
  }

  async listForExpense(organizationId: string, expenseId: string): Promise<Payment[]> {
    return this.listBy(organizationId, "expense_id", expenseId);
  }

  private async listBy(
    organizationId: string,
    column: "order_id" | "expense_id",
    documentId: string,
  ): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from("payments")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq(column, documentId)
      .order("occurred_at", { ascending: false })
      // Desempate por la hora del servidor: `occurred_at` lo fija el cliente
      // desde un campo con precisión de minuto, así que dos cobros seguidos
      // comparten instante y sin esto su orden sería indeterminado.
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`No se pudieron cargar los cobros: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as unknown as PaymentRow));
  }

  /**
   * Registrar un cobro. La dirección la pone el destino y no el llamador: un
   * movimiento contra un pedido solo puede ser `in`, y la base lo impone con
   * `direction_matches_target`.
   */
  async registerCollection(
    organizationId: string,
    values: CollectionValues,
  ): Promise<void> {
    await this.insert({
      id: values.id,
      organization_id: organizationId,
      direction: "in",
      order_id: values.orderId,
      amount: values.amount,
      method: values.method,
      occurred_at: values.occurredAt,
      note: values.note,
    });
  }

  /** Registrar un pago contra un egreso. Siempre `out`, por el mismo motivo. */
  async registerPayment(
    organizationId: string,
    values: PaymentValues,
  ): Promise<void> {
    await this.insert({
      id: values.id,
      organization_id: organizationId,
      direction: "out",
      expense_id: values.expenseId,
      amount: values.amount,
      method: values.method,
      occurred_at: values.occurredAt,
      note: values.note,
    });
  }

  private async insert(row: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.from("payments").insert(row);
    if (error) {
      throw new Error(`No se pudo registrar el movimiento: ${error.message}`);
    }
  }

  /**
   * Anular es archivar, nunca borrar ni editar (convención nº 3). El importe
   * no se toca: el hecho queda como fue y deja de contar en `paid`.
   */
  async voidPayment(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("payments")
      .update({ archived_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo anular el movimiento: ${error.message}`);
    }
  }

  /**
   * `total` y `paid` de un conjunto de pedidos, en una sola consulta. El
   * saldo no viaja: se deriva al leer.
   */
  async orderTotals(
    organizationId: string,
    orderIds: readonly string[],
  ): Promise<Map<string, DocumentPaid>> {
    return this.totalsFrom("order_totals", "order_id", organizationId, orderIds);
  }

  async expenseTotals(
    organizationId: string,
    expenseIds: readonly string[],
  ): Promise<Map<string, DocumentPaid>> {
    return this.totalsFrom("expense_totals", "expense_id", organizationId, expenseIds);
  }

  private async totalsFrom(
    view: "order_totals" | "expense_totals",
    key: "order_id" | "expense_id",
    organizationId: string,
    ids: readonly string[],
  ): Promise<Map<string, DocumentPaid>> {
    const totals = new Map<string, DocumentPaid>();
    if (ids.length === 0) return totals;

    const { data, error } = await this.supabase
      .from(view)
      .select(`${key}, total, paid`)
      .eq("organization_id", organizationId)
      .in(key, [...ids]);

    if (error) {
      throw new Error(`No se pudieron calcular los saldos: ${error.message}`);
    }

    for (const row of (data ?? []) as Record<string, string | number>[]) {
      totals.set(String(row[key]), {
        total: toNumber(row.total),
        paid: toNumber(row.paid),
      });
    }

    return totals;
  }

  /**
   * Por cobrar por línea. Al ayudante, `payables` le devuelve cero filas por
   * `security_invoker` y sin una línea de lógica aquí (design D7).
   */
  async receivables(organizationId: string): Promise<OutstandingByLine[]> {
    return this.outstanding("receivables_by_line", organizationId);
  }

  async payables(organizationId: string): Promise<OutstandingByLine[]> {
    return this.outstanding("payables_by_line", organizationId);
  }

  private async outstanding(
    view: "receivables_by_line" | "payables_by_line",
    organizationId: string,
  ): Promise<OutstandingByLine[]> {
    const { data, error } = await this.supabase
      .from(view)
      .select("organization_id, business_line_id, outstanding")
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudo calcular lo pendiente: ${error.message}`);
    }

    return (data ?? []).map((row) => {
      const typed = row as {
        organization_id: string;
        business_line_id: string;
        outstanding: number | string;
      };
      return {
        organizationId: typed.organization_id,
        businessLineId: typed.business_line_id,
        outstanding: toNumber(typed.outstanding),
      };
    });
  }
}
