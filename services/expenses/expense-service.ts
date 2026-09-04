import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CostFormValues,
  PurchaseFormValues,
  PurchaseLineValues,
} from "@/lib/expenses/schema";
import type { ActivityEntry, Expense, ExpenseKind } from "@/types";

type ExpenseRow = {
  id: string;
  organization_id: string;
  business_line_id: string;
  kind: string;
  contact_id: string | null;
  expense_category_id: string | null;
  order_id: string | null;
  amount: number | string | null;
  occurred_at: string;
  note: string | null;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, business_line_id, kind, contact_id, expense_category_id, " +
  "order_id, amount, occurred_at, note, archived_at";

export type ExpenseFilters = {
  businessLineId?: string | null;
  kind?: ExpenseKind | null;
  contactId?: string | null;
  expenseCategoryId?: string | null;
  /** Instante inclusivo desde el que se cuenta `occurred_at`. */
  from?: string | null;
  /** Instante exclusivo hasta el que se cuenta `occurred_at`. */
  to?: string | null;
  includeArchived?: boolean;
};

/**
 * Un egreso con el total y lo pagado que trae la vista, nunca columnas de la
 * tabla. El saldo no viaja: se deriva al leer con `lib/payments/balance.ts`.
 */
export type ExpenseWithTotal = Expense & { total: number; paid: number };

type ExpenseTotals = { total: number; paid: number };

/** Un egreso fuera de la vista —archivado— parte de cero y se completa. */
const NO_MONEY: ExpenseTotals = { total: 0, paid: 0 };

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Una línea como la espera `create_expense`: nombres de columna, porque el
 * jsonb entra directo en el `insert` de la base.
 */
function toItemPayload(line: PurchaseLineValues) {
  return {
    id: line.id,
    item_id: line.itemId,
    variant_id: line.variantId,
    quantity: line.quantity,
    // El precio que se pagó. El catálogo puede cambiar después y esta línea
    // no se entera (esquema §2).
    unit_price: line.unitPrice,
  };
}

/**
 * Acceso a `expenses`. Ninguna consulta a Supabase vive fuera de aquí, y
 * todas filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2).
 *
 * Quién puede leer y escribir lo decide RLS (solo el dueño, matriz §16) y
 * quién archiva, `enforce_archive_rules`: este servicio solo pide. El total
 * viene de `expense_totals` y jamás de una columna.
 */
export class ExpenseService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: ExpenseRow): Expense {
    return {
      id: row.id,
      organizationId: row.organization_id,
      businessLineId: row.business_line_id,
      kind: row.kind as ExpenseKind,
      contactId: row.contact_id,
      expenseCategoryId: row.expense_category_id,
      orderId: row.order_id,
      amount: row.amount === null ? null : toNumber(row.amount),
      occurredAt: row.occurred_at,
      note: row.note,
      archivedAt: row.archived_at,
    };
  }

  /**
   * Los totales de un conjunto de egresos, en una sola consulta a la vista.
   * La vista excluye lo archivado: para esas filas, que solo aparecen con
   * "Ver archivados", el total se arma aparte con el mismo cálculo.
   */
  private async totalsFor(expenses: Expense[]): Promise<Map<string, ExpenseTotals>> {
    const totals = new Map<string, ExpenseTotals>();
    if (expenses.length === 0) return totals;

    const { data, error } = await this.supabase
      .from("expense_totals")
      .select("expense_id, total, paid")
      .in(
        "expense_id",
        expenses.map((expense) => expense.id),
      );

    if (error) {
      throw new Error(`No se pudieron calcular los totales: ${error.message}`);
    }

    for (const row of (data ?? []) as {
      expense_id: string;
      total: number | string;
      paid: number | string;
    }[]) {
      totals.set(row.expense_id, {
        total: toNumber(row.total),
        paid: toNumber(row.paid),
      });
    }

    // Lo archivado no está en la vista. Un gasto archivado es su monto; una
    // compra archivada, la suma de sus líneas.
    const archived: string[] = [];
    const archivedPurchases: string[] = [];
    for (const expense of expenses) {
      if (!expense.archivedAt || totals.has(expense.id)) continue;
      archived.push(expense.id);
      if (expense.kind === "expense") {
        totals.set(expense.id, { total: expense.amount ?? 0, paid: 0 });
      } else {
        archivedPurchases.push(expense.id);
      }
    }

    if (archivedPurchases.length > 0) {
      const { data: lines, error: linesError } = await this.supabase
        .from("expense_items")
        .select("expense_id, quantity, unit_price")
        .in("expense_id", archivedPurchases);

      if (linesError) {
        throw new Error(`No se pudieron calcular los totales: ${linesError.message}`);
      }

      for (const id of archivedPurchases) totals.set(id, { ...NO_MONEY });
      for (const line of (lines ?? []) as {
        expense_id: string;
        quantity: number | string;
        unit_price: number | string;
      }[]) {
        const current = totals.get(line.expense_id) ?? { ...NO_MONEY };
        totals.set(line.expense_id, {
          ...current,
          total:
            current.total + toNumber(line.quantity) * toNumber(line.unit_price),
        });
      }
    }

    // Lo pagado de un egreso archivado tampoco está en la vista. Se suma con
    // la misma regla —solo movimientos vigentes— para que el saldo de un
    // egreso archivado no aparezca como si nunca se hubiera pagado.
    if (archived.length > 0) {
      const { data: paidRows, error: paidError } = await this.supabase
        .from("payments")
        .select("expense_id, amount")
        .in("expense_id", archived)
        .is("archived_at", null);

      if (paidError) {
        throw new Error(`No se pudieron calcular los totales: ${paidError.message}`);
      }

      for (const row of (paidRows ?? []) as {
        expense_id: string;
        amount: number | string;
      }[]) {
        const current = totals.get(row.expense_id) ?? { ...NO_MONEY };
        totals.set(row.expense_id, {
          ...current,
          paid: current.paid + toNumber(row.amount),
        });
      }
    }

    return totals;
  }

  async list(
    organizationId: string,
    filters: ExpenseFilters = {},
  ): Promise<ExpenseWithTotal[]> {
    let query = this.supabase
      .from("expenses")
      .select(COLUMNS)
      .eq("organization_id", organizationId);

    if (filters.businessLineId) {
      query = query.eq("business_line_id", filters.businessLineId);
    }
    if (filters.kind) query = query.eq("kind", filters.kind);
    if (filters.contactId) query = query.eq("contact_id", filters.contactId);
    if (filters.expenseCategoryId) {
      query = query.eq("expense_category_id", filters.expenseCategoryId);
    }
    if (filters.from) query = query.gte("occurred_at", filters.from);
    if (filters.to) query = query.lt("occurred_at", filters.to);

    // Lo archivado no aparece salvo que se pida: es la regla de todo listado.
    if (!filters.includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query.order("occurred_at", { ascending: false });

    if (error) {
      throw new Error(`No se pudieron cargar los egresos: ${error.message}`);
    }

    const expenses = (data ?? []).map((row) =>
      this.toEntity(row as unknown as ExpenseRow),
    );
    const totals = await this.totalsFor(expenses);

    return expenses.map((expense) => ({
      ...expense,
      ...(totals.get(expense.id) ?? NO_MONEY),
    }));
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ExpenseWithTotal | null> {
    const { data, error } = await this.supabase
      .from("expenses")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo cargar el egreso: ${error.message}`);
    }
    if (!data) return null;

    const expense = this.toEntity(data as unknown as ExpenseRow);
    const totals = await this.totalsFor([expense]);

    return { ...expense, ...(totals.get(expense.id) ?? NO_MONEY) };
  }

  /**
   * Alta de un gasto (V9). Una sola llamada: `create_expense` inserta el
   * encabezado en la misma transacción que —en la compra— sus líneas
   * (design D2). Aquí no viaja ningún total: es un derivado.
   */
  async createCost(organizationId: string, values: CostFormValues): Promise<string> {
    return this.create(
      {
        id: values.id,
        organization_id: organizationId,
        business_line_id: values.businessLineId,
        kind: "expense",
        expense_category_id: values.expenseCategoryId,
        order_id: values.orderId,
        amount: values.amount,
        occurred_at: values.occurredAt,
        note: values.note,
      },
      [],
    );
  }

  /** Alta de una compra (V8): encabezado y líneas, o nada. */
  async createPurchase(
    organizationId: string,
    values: PurchaseFormValues,
  ): Promise<string> {
    return this.create(
      {
        id: values.id,
        organization_id: organizationId,
        business_line_id: values.businessLineId,
        kind: "purchase",
        contact_id: values.contactId,
        occurred_at: values.occurredAt,
        note: values.note,
      },
      values.items.map(toItemPayload),
    );
  }

  private async create(
    expense: Record<string, unknown>,
    items: Record<string, unknown>[],
  ): Promise<string> {
    const { data, error } = await this.supabase.rpc("create_expense", {
      p_expense: expense,
      p_items: items,
    });

    // El mensaje de la base ya está escrito para una persona; se envuelve en
    // un `Error` para que la acción pueda traducirlo.
    if (error) throw new Error(error.message);

    return (data as string | null) ?? (expense.id as string);
  }

  /**
   * Archivar y desarchivar. Quién puede hacerlo lo decide el trigger
   * `enforce_archive_rules`: aquí solo se pide, y el error de la base sube
   * tal cual para que la acción lo traduzca.
   */
  async setArchived(
    organizationId: string,
    id: string,
    archived: boolean,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("expenses")
      .update({
        archived_at: archived ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) throw error;
  }

  /**
   * El historial del egreso. Un solo historial (convención nº 7): todo lo
   * que muestre "qué pasó aquí" lee de `activity_log`.
   */
  async history(organizationId: string, id: string): Promise<ActivityEntry[]> {
    const { data, error } = await this.supabase
      .from("activity_log")
      .select("id, action, actor_id, actor_label, changes, occurred_at")
      .eq("organization_id", organizationId)
      .eq("table_name", "expenses")
      .eq("record_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`No se pudo cargar el historial: ${error.message}`);
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as number,
      action: row.action as ActivityEntry["action"],
      actorId: (row.actor_id as string | null) ?? null,
      actorLabel: (row.actor_label as string | null) ?? null,
      changes: (row.changes as Record<string, unknown> | null) ?? null,
      occurredAt: row.occurred_at as string,
    }));
  }
}
