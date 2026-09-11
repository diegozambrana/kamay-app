import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AssetDetails,
  AssetExpenseRole,
  AssetRecovery,
  Expense,
} from "@/types";

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type RecoveryRow = {
  item_id: string;
  organization_id: string;
  business_line_id: string | null;
  name: string;
  acquired_on: string;
  acquisition_cost: number | string;
  maintenance_cost: number | string;
  total_cost: number | string;
  line_margin_since: number | string;
};

const RECOVERY_COLUMNS =
  "item_id, organization_id, business_line_id, name, acquired_on, " +
  "acquisition_cost, maintenance_cost, total_cost, line_margin_since";

const DETAILS_COLUMNS =
  "item_id, organization_id, acquisition_cost, acquired_on, supplier_id, notes";

export type AssetFilters = {
  businessLineId?: string | null;
  includeArchived?: boolean;
};

/** Los datos que el formulario de activo escribe. */
export type AssetDetailsInput = {
  itemId: string;
  acquisitionCost: number;
  acquiredOn: string;
  supplierId: string | null;
  notes: string | null;
};

/** Un egreso del activo, con su total ya resuelto para la lista del panel. */
export type AssetExpense = Expense & { total: number };

/**
 * Acceso a los activos (V12). Ninguna consulta a Supabase vive fuera de aquí,
 * y todas filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2).
 *
 * Quién puede leer y escribir lo decide RLS —solo la persona dueña, matriz
 * §16— y el porcentaje no se calcula aquí: la vista entrega ingredientes y la
 * fórmula vive en `lib/assets/recovery.ts` (design D5). Este servicio pide.
 */
export class AssetService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toRecovery(row: RecoveryRow): AssetRecovery {
    return {
      itemId: row.item_id,
      organizationId: row.organization_id,
      businessLineId: row.business_line_id,
      name: row.name,
      acquiredOn: row.acquired_on,
      acquisitionCost: toNumber(row.acquisition_cost),
      maintenanceCost: toNumber(row.maintenance_cost),
      totalCost: toNumber(row.total_cost),
      lineMarginSince: toNumber(row.line_margin_since),
    };
  }

  /**
   * Los activos de la organización con sus ingredientes de recuperación.
   *
   * El recorte por línea y por archivado va en la consulta, no en memoria: con
   * meses de historia, filtrar después sería traer filas para tirarlas. El
   * archivado se lee del ítem, que es donde vive —un activo no tiene archivado
   * propio— y por eso la consulta se apoya en la relación con `items`.
   */
  async list(organizationId: string, filters: AssetFilters = {}): Promise<AssetRecovery[]> {
    let query = this.supabase
      .from("asset_recovery")
      .select(`${RECOVERY_COLUMNS}, items!inner(archived_at)`)
      .eq("organization_id", organizationId);

    if (filters.businessLineId) {
      query = query.eq("business_line_id", filters.businessLineId);
    }

    if (!filters.includeArchived) {
      query = query.is("items.archived_at", null);
    }

    const { data, error } = await query.order("acquired_on", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((row) => this.toRecovery(row as unknown as RecoveryRow));
  }

  /** Un activo concreto, con sus ingredientes de recuperación. */
  async recovery(organizationId: string, itemId: string): Promise<AssetRecovery | null> {
    const { data, error } = await this.supabase
      .from("asset_recovery")
      .select(RECOVERY_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) throw error;
    return data ? this.toRecovery(data as unknown as RecoveryRow) : null;
  }

  /** Los datos declarados de un activo, para el formulario que los edita. */
  async details(organizationId: string, itemId: string): Promise<AssetDetails | null> {
    const { data, error } = await this.supabase
      .from("asset_details")
      .select(DETAILS_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as {
      item_id: string;
      organization_id: string;
      acquisition_cost: number | string;
      acquired_on: string;
      supplier_id: string | null;
      notes: string | null;
    };

    return {
      itemId: row.item_id,
      organizationId: row.organization_id,
      acquisitionCost: toNumber(row.acquisition_cost),
      acquiredOn: row.acquired_on,
      supplierId: row.supplier_id,
      notes: row.notes,
    };
  }

  /**
   * Alta y edición de los datos del activo en una sola operación.
   *
   * `upsert` y no dos caminos: el formulario es el mismo y la persona no
   * distingue entre declarar por primera vez y corregir. El `check` de tipo de
   * ítem y la pertenencia a la organización los impone la base.
   */
  async save(organizationId: string, input: AssetDetailsInput): Promise<void> {
    const { error } = await this.supabase.from("asset_details").upsert(
      {
        item_id: input.itemId,
        organization_id: organizationId,
        acquisition_cost: input.acquisitionCost,
        acquired_on: input.acquiredOn,
        supplier_id: input.supplierId,
        notes: input.notes,
      },
      { onConflict: "item_id" },
    );

    if (error) throw error;
  }

  /**
   * Los egresos que pertenecen a un activo, con su total.
   *
   * Dos consultas y no una incrustada: `expense_totals` es una vista y
   * PostgREST no sabe unirla a `expenses` sin una foránea que una vista no
   * puede tener. Es el mismo camino que ya recorre `ExpenseService`.
   *
   * Se piden ambos papeles: el panel muestra la adquisición aparte del
   * mantenimiento, y quien consume distingue por `assetExpenseRole` en vez de
   * hacer dos viajes a la base.
   */
  async expenses(organizationId: string, itemId: string): Promise<AssetExpense[]> {
    const { data, error } = await this.supabase
      .from("expenses")
      .select(
        "id, organization_id, business_line_id, kind, contact_id, expense_category_id, " +
          "order_id, amount, occurred_at, note, asset_id, asset_expense_role, archived_at",
      )
      .eq("organization_id", organizationId)
      .eq("asset_id", itemId)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as unknown as {
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
      asset_id: string | null;
      asset_expense_role: string | null;
      archived_at: string | null;
    }[];

    if (rows.length === 0) return [];

    const { data: totalRows, error: totalsError } = await this.supabase
      .from("expense_totals")
      .select("expense_id, total")
      .eq("organization_id", organizationId)
      .in(
        "expense_id",
        rows.map((row) => row.id),
      );

    if (totalsError) throw totalsError;

    const totals = new Map(
      ((totalRows ?? []) as unknown as { expense_id: string; total: number | string }[]).map(
        (row) => [row.expense_id, toNumber(row.total)],
      ),
    );

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      businessLineId: row.business_line_id,
      kind: row.kind as Expense["kind"],
      contactId: row.contact_id,
      expenseCategoryId: row.expense_category_id,
      orderId: row.order_id,
      amount: row.amount === null ? null : toNumber(row.amount),
      occurredAt: row.occurred_at,
      note: row.note,
      assetId: row.asset_id,
      assetExpenseRole: row.asset_expense_role as AssetExpenseRole | null,
      archivedAt: row.archived_at,
      total: totals.get(row.id) ?? 0,
    }));
  }
}
