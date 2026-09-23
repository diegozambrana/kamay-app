import type {
  AttributeScope,
  AttributeType,
  ItemCategoryAttribute,
} from "@/types";

import { ConfigTableService } from "./config-table-service";

type ItemCategoryAttributeRow = {
  id: string;
  organization_id: string;
  category_id: string;
  name: string;
  type: string;
  unit: string | null;
  options: unknown;
  required: boolean;
  scope: string;
  position: number;
  archived_at: string | null;
};

/** Un solo literal: concatenado, PostgREST pierde el tipo del `select`. */
const COLUMNS =
  "id, organization_id, category_id, name, type, unit, options, required, scope, position, archived_at";

/**
 * Acceso a `item_category_attributes`: los atributos que declara cada
 * categoría de ítem (`catalog-custom-attributes`, design D5).
 *
 * Tipo, alcance y categoría solo se escriben al crear: `update` no los toca, y
 * un trigger de la base rechaza el cambio si una petición lo intentara.
 */
export class ItemCategoryAttributeService extends ConfigTableService<
  ItemCategoryAttributeRow,
  ItemCategoryAttribute
> {
  protected readonly table = "item_category_attributes";
  protected readonly columns = COLUMNS;
  protected readonly orderBy = [
    { column: "position", ascending: true },
    { column: "created_at", ascending: true },
  ];
  protected readonly label = "los atributos de la categoría";

  protected toEntity(row: ItemCategoryAttributeRow): ItemCategoryAttribute {
    return {
      id: row.id,
      organizationId: row.organization_id,
      categoryId: row.category_id,
      name: row.name,
      type: row.type as AttributeType,
      unit: row.unit,
      options: Array.isArray(row.options)
        ? row.options.filter((option): option is string => typeof option === "string")
        : [],
      required: row.required,
      scope: row.scope as AttributeScope,
      position: row.position,
      archivedAt: row.archived_at,
    };
  }

  /** Los atributos de una categoría, por posición; archivados solo si se piden. */
  async listForCategory(
    organizationId: string,
    categoryId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<ItemCategoryAttribute[]> {
    return this.listWhere(organizationId, [categoryId], options.includeArchived ?? false);
  }

  /**
   * Los atributos de varias categorías de una vez: el formulario de ítem los
   * necesita todos para cambiar de campos al cambiar de categoría, y el
   * detalle también los archivados para rotular lo que ya no se pide.
   */
  async listForCategories(
    organizationId: string,
    categoryIds: readonly string[],
    options: { includeArchived?: boolean } = {},
  ): Promise<ItemCategoryAttribute[]> {
    if (categoryIds.length === 0) return [];
    return this.listWhere(organizationId, categoryIds, options.includeArchived ?? false);
  }

  /** Los vigentes de varias categorías: lo que ofrecen formularios y filtros. */
  async listActiveForCategories(
    organizationId: string,
    categoryIds: readonly string[],
  ): Promise<ItemCategoryAttribute[]> {
    return this.listForCategories(organizationId, categoryIds);
  }

  private async listWhere(
    organizationId: string,
    categoryIds: readonly string[],
    includeArchived: boolean,
  ): Promise<ItemCategoryAttribute[]> {
    let query = this.supabase
      .from(this.table)
      .select(COLUMNS)
      // Convención nº 2: la organización, explícita, aunque RLS ya filtre.
      .eq("organization_id", organizationId)
      .in("category_id", [...categoryIds]);

    if (!includeArchived) query = query.is("archived_at", null);

    const { data, error } = await query
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`No se pudo cargar ${this.label}: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as ItemCategoryAttributeRow));
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<ItemCategoryAttribute | null> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ItemCategoryAttributeRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar el atributo: ${error.message}`);
    }

    return data ? this.toEntity(data as ItemCategoryAttributeRow) : null;
  }

  /**
   * Alta al final de la categoría: la posición es la mayor que ya existe,
   * contando los archivados, más uno. Así restaurar uno no lo empata con otro.
   */
  async create(
    organizationId: string,
    input: {
      categoryId: string;
      name: string;
      type: AttributeType;
      unit: string | null;
      options: string[];
      required: boolean;
      scope: AttributeScope;
    },
  ): Promise<ItemCategoryAttribute> {
    const { data, error } = await this.supabase
      .from(this.table)
      .select("position")
      .eq("organization_id", organizationId)
      .eq("category_id", input.categoryId)
      .order("position", { ascending: false })
      .limit(1)
      .overrideTypes<{ position: number }[]>();

    if (error) {
      throw new Error(`No se pudo crear el atributo: ${error.message}`);
    }

    const position = (data?.[0]?.position ?? 0) + 1;

    return this.insert(organizationId, {
      category_id: input.categoryId,
      name: input.name,
      type: input.type,
      unit: input.unit,
      options: input.options,
      required: input.required,
      scope: input.scope,
      position,
    });
  }

  /** Nombre, unidad, opciones y obligatoriedad. Nunca tipo, alcance ni categoría. */
  async update(
    organizationId: string,
    id: string,
    input: { name: string; unit: string | null; options: string[]; required: boolean },
  ): Promise<ItemCategoryAttribute> {
    return this.patch(organizationId, id, {
      name: input.name,
      unit: input.unit,
      options: input.options,
      required: input.required,
      updated_at: new Date().toISOString(),
    });
  }
}
