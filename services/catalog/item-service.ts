import type { SupabaseClient } from "@supabase/supabase-js";

import type { ItemFormValues } from "@/lib/catalog/schema";
import { normalizeForSearch } from "@/lib/search/normalize";
import {
  VARIANT_COLUMNS,
  variantFromRow,
  type VariantRow,
} from "@/services/catalog/item-variant-service";
import type { ActivityEntry, Item, ItemKind, ItemVariant } from "@/types";

type ItemRow = {
  id: string;
  organization_id: string;
  business_line_id: string | null;
  kind: string;
  name: string;
  description: string | null;
  unit_id: string | null;
  category: string | null;
  sale_price: number | string | null;
  min_stock: number | string | null;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, business_line_id, kind, name, description, unit_id, category, sale_price, min_stock, archived_at";

export type ItemFilters = {
  kind?: ItemKind;
  /** `null` no filtra por línea; para ver solo los compartidos, `"shared"`. */
  businessLineId?: string | "shared" | null;
  search?: string;
  includeArchived?: boolean;
};

/** `numeric` llega como texto desde PostgREST: no se pierde precisión. */
function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Acceso a `items`. Ninguna consulta a Supabase vive fuera de aquí, y todas
 * filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2). El archivado lo autoriza la base (trigger
 * `enforce_archive_rules`): aquí solo se pide.
 */
export class ItemService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: ItemRow): Item {
    return {
      id: row.id,
      organizationId: row.organization_id,
      businessLineId: row.business_line_id,
      kind: row.kind as ItemKind,
      name: row.name,
      description: row.description,
      unitId: row.unit_id,
      category: row.category,
      salePrice: toNumber(row.sale_price),
      minStock: toNumber(row.min_stock),
      archivedAt: row.archived_at,
    };
  }

  async list(organizationId: string, filters: ItemFilters = {}): Promise<Item[]> {
    let query = this.supabase
      .from("items")
      .select(COLUMNS)
      .eq("organization_id", organizationId);

    if (filters.kind) query = query.eq("kind", filters.kind);

    if (filters.businessLineId === "shared") {
      query = query.is("business_line_id", null);
    } else if (filters.businessLineId) {
      query = query.eq("business_line_id", filters.businessLineId);
    }

    // Lo archivado no aparece salvo que se pida: es la regla de todo listado.
    if (!filters.includeArchived) query = query.is("archived_at", null);

    // `search_name` es el nombre ya normalizado en la base; el término se
    // normaliza aquí con la misma función. Misma regla en los dos lados.
    const term = normalizeForSearch(filters.search ?? "");
    if (term !== "") {
      query = query.like("search_name", `%${term}%`);
    }

    const { data, error } = await query
      .order("name", { ascending: true })
      .overrideTypes<ItemRow[]>();

    if (error) {
      throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as ItemRow));
  }

  /**
   * Los productos vigentes con sus variantes vigentes, en una sola consulta:
   * es lo que alimenta el buscador del formulario de pedido (V5). Una
   * petición por producto para traer sus variantes sería una cascada, y el
   * formulario las necesita todas a la vez para poder filtrar en memoria.
   *
   * Solo `product`: un insumo no se vende y un activo tampoco. Es una
   * decisión de interfaz y no de datos — `order_items.item_id` admite
   * cualquier ítem.
   *
   * Las variantes archivadas se descartan aquí y no en la consulta porque un
   * filtro sobre un recurso incrustado filtraría el producto padre, y un
   * producto no debe desaparecer del buscador por tener una variante vieja.
   */
  async listProductsWithVariants(
    organizationId: string,
  ): Promise<(Item & { variants: ItemVariant[] })[]> {
    const { data, error } = await this.supabase
      .from("items")
      .select(`${COLUMNS}, item_variants(${VARIANT_COLUMNS})`)
      .eq("organization_id", organizationId)
      .eq("kind", "product")
      .is("archived_at", null)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`No se pudieron cargar los productos: ${error.message}`);
    }

    return (data ?? []).map((raw) => {
      const row = raw as unknown as ItemRow & {
        item_variants: VariantRow[] | null;
      };

      return {
        ...this.toEntity(row),
        variants: (row.item_variants ?? [])
          .filter((variant) => variant.archived_at === null)
          .map(variantFromRow)
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      };
    });
  }

  async findById(organizationId: string, id: string): Promise<Item | null> {
    const { data, error } = await this.supabase
      .from("items")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ItemRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar el ítem: ${error.message}`);
    }

    return data ? this.toEntity(data as ItemRow) : null;
  }

  async create(
    organizationId: string,
    id: string,
    input: ItemFormValues,
  ): Promise<Item> {
    const { data, error } = await this.supabase
      .from("items")
      .insert({
        id,
        organization_id: organizationId,
        business_line_id: input.businessLineId,
        kind: input.kind,
        name: input.name,
        description: input.description,
        unit_id: input.unitId,
        category: input.category,
        sale_price: input.salePrice,
        min_stock: input.minStock,
      })
      .select(COLUMNS)
      .single()
      .overrideTypes<ItemRow>();

    if (error) {
      throw new Error(`No se pudo crear el ítem: ${error.message}`);
    }

    return this.toEntity(data as ItemRow);
  }

  async update(
    organizationId: string,
    id: string,
    input: ItemFormValues,
  ): Promise<Item> {
    const { data, error } = await this.supabase
      .from("items")
      .update({
        business_line_id: input.businessLineId,
        kind: input.kind,
        name: input.name,
        description: input.description,
        unit_id: input.unitId,
        category: input.category,
        sale_price: input.salePrice,
        min_stock: input.minStock,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .select(COLUMNS)
      .single()
      .overrideTypes<ItemRow>();

    if (error) {
      throw new Error(`No se pudo guardar el ítem: ${error.message}`);
    }

    return this.toEntity(data as ItemRow);
  }

  /** Archivar y desarchivar: la base comprueba que quien pide sea el dueño. */
  async setArchived(
    organizationId: string,
    id: string,
    archived: boolean,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("items")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(
        `No se pudo ${archived ? "archivar" : "desarchivar"} el ítem: ${error.message}`,
      );
    }
  }

  /**
   * Historial del ítem (V11). Convención nº 7: todo lo que muestra "qué pasó
   * aquí" lee de `activity_log` y de ninguna otra fuente. La bitácora solo es
   * legible por el dueño; para el ayudante esto devuelve vacío por RLS.
   */
  async history(organizationId: string, id: string): Promise<ActivityEntry[]> {
    const { data, error } = await this.supabase
      .from("activity_log")
      .select("id, action, actor_id, actor_label, changes, occurred_at")
      .eq("organization_id", organizationId)
      .eq("table_name", "items")
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
