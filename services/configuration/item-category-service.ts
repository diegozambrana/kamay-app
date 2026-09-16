import type { ItemCategory, ItemKind } from "@/types";

import { ConfigTableService } from "./config-table-service";

type ItemCategoryRow = {
  id: string;
  organization_id: string;
  kind: string;
  name: string;
  archived_at: string | null;
};

/**
 * Acceso a `item_categories`: las categorías de ítem, una lista por tipo.
 *
 * El listado base de `ConfigTableService` no conoce el tipo, así que este
 * servicio añade `listByKind`. El tipo solo se escribe al crear: renombrar no
 * lo toca, porque una categoría no cambia de tipo (la clave compuesta de
 * `items` lo impide además en cuanto tiene ítems).
 */
export class ItemCategoryService extends ConfigTableService<
  ItemCategoryRow,
  ItemCategory
> {
  protected readonly table = "item_categories";
  protected readonly columns = "id, organization_id, kind, name, archived_at";
  protected readonly orderBy = [{ column: "name", ascending: true }];
  protected readonly label = "las categorías de ítem";

  protected toEntity(row: ItemCategoryRow): ItemCategory {
    return {
      id: row.id,
      organizationId: row.organization_id,
      kind: row.kind as ItemKind,
      name: row.name,
      archivedAt: row.archived_at,
    };
  }

  /** Las categorías de un tipo, por nombre; las archivadas solo si se piden. */
  async listByKind(
    organizationId: string,
    kind: ItemKind,
    options: { includeArchived?: boolean } = {},
  ): Promise<ItemCategory[]> {
    let query = this.supabase
      .from(this.table)
      .select(this.columns)
      // Convención nº 2: la organización, explícita, aunque RLS ya filtre.
      .eq("organization_id", organizationId)
      .eq("kind", kind);

    if (!options.includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query.order("name", { ascending: true });
    if (error) {
      throw new Error(`No se pudo cargar ${this.label}: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as ItemCategoryRow));
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ItemCategory | null> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select(this.columns)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ItemCategoryRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar la categoría: ${error.message}`);
    }

    return data ? this.toEntity(data as ItemCategoryRow) : null;
  }

  async create(
    organizationId: string,
    input: { kind: ItemKind; name: string },
  ): Promise<ItemCategory> {
    return this.insert(organizationId, { kind: input.kind, name: input.name });
  }

  /** Solo el nombre: el tipo se fijó al crear. */
  async rename(
    organizationId: string,
    id: string,
    input: { name: string },
  ): Promise<ItemCategory> {
    return this.patch(organizationId, id, {
      name: input.name,
      updated_at: new Date().toISOString(),
    });
  }
}
