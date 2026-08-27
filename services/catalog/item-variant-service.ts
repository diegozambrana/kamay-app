import type { SupabaseClient } from "@supabase/supabase-js";

import type { ItemVariantFormValues } from "@/lib/catalog/schema";
import type { ItemVariant } from "@/types";

type VariantRow = {
  id: string;
  organization_id: string;
  item_id: string;
  name: string;
  attributes: Record<string, unknown> | null;
  sale_price: number | string | null;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, item_id, name, attributes, sale_price, archived_at";

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Acceso a `item_variants`. Las variantes se listan siempre por su ítem. */
export class ItemVariantService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: VariantRow): ItemVariant {
    return {
      id: row.id,
      organizationId: row.organization_id,
      itemId: row.item_id,
      name: row.name,
      attributes: row.attributes ?? {},
      salePrice: toNumber(row.sale_price),
      archivedAt: row.archived_at,
    };
  }

  async listForItem(
    organizationId: string,
    itemId: string,
    includeArchived = false,
  ): Promise<ItemVariant[]> {
    let query = this.supabase
      .from("item_variants")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("item_id", itemId);

    if (!includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query
      .order("name", { ascending: true })
      .overrideTypes<VariantRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las variantes: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as VariantRow));
  }

  async create(
    organizationId: string,
    itemId: string,
    id: string,
    input: ItemVariantFormValues,
  ): Promise<ItemVariant> {
    const { data, error } = await this.supabase
      .from("item_variants")
      .insert({
        id,
        organization_id: organizationId,
        item_id: itemId,
        name: input.name,
        sale_price: input.salePrice,
      })
      .select(COLUMNS)
      .single()
      .overrideTypes<VariantRow>();

    if (error) {
      throw new Error(`No se pudo crear la variante: ${error.message}`);
    }

    return this.toEntity(data as VariantRow);
  }

  async update(
    organizationId: string,
    id: string,
    input: ItemVariantFormValues,
  ): Promise<ItemVariant> {
    const { data, error } = await this.supabase
      .from("item_variants")
      .update({
        name: input.name,
        sale_price: input.salePrice,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .select(COLUMNS)
      .single()
      .overrideTypes<VariantRow>();

    if (error) {
      throw new Error(`No se pudo guardar la variante: ${error.message}`);
    }

    return this.toEntity(data as VariantRow);
  }

  async setArchived(
    organizationId: string,
    id: string,
    archived: boolean,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("item_variants")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(
        `No se pudo ${archived ? "archivar" : "desarchivar"} la variante: ${error.message}`,
      );
    }
  }
}
