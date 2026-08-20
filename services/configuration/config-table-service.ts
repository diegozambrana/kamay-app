import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Base de las cuatro tablas de configuración. Todas comparten forma
 * (`organization_id`, `archived_at`, único por organización) y las mismas
 * cuatro operaciones, así que el filtro por organización y por `archived_at`
 * —lo único que no se puede olvidar— vive en un solo sitio.
 *
 * Cada subclase declara sus columnas y cómo se traduce una fila a su tipo.
 */
export abstract class ConfigTableService<TRow, TEntity> {
  constructor(protected readonly supabase: SupabaseClient) {}

  /** Nombre de la tabla en Postgres. */
  protected abstract readonly table: string;

  /** Columnas a pedir en cada `select`. */
  protected abstract readonly columns: string;

  /** Orden estable de la lista (la posición donde la puso el dueño). */
  protected abstract readonly orderBy: { column: string; ascending: boolean }[];

  protected abstract toEntity(row: TRow): TEntity;

  /** Texto para los mensajes de error, en singular. */
  protected abstract readonly label: string;

  /** Lo vigente: lo que se ofrece en el selector y en los formularios. */
  async listActive(organizationId: string): Promise<TEntity[]> {
    return this.list(organizationId, true);
  }

  /** Todo, incluido lo archivado: solo la pantalla de configuración lo pide. */
  async listAll(organizationId: string): Promise<TEntity[]> {
    return this.list(organizationId, false);
  }

  private async list(
    organizationId: string,
    onlyActive: boolean,
  ): Promise<TEntity[]> {
    // organization_id explícito aunque RLS ya filtre (convención nº 2).
    let query = this.supabase
      .from(this.table)
      .select(this.columns)
      .eq("organization_id", organizationId);

    if (onlyActive) query = query.is("archived_at", null);

    for (const { column, ascending } of this.orderBy) {
      query = query.order(column, { ascending });
    }

    const { data, error } = await query.overrideTypes<TRow[]>();

    if (error) {
      throw new Error(`No se pudo cargar ${this.label}: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as TRow));
  }

  protected async insert(
    organizationId: string,
    values: Record<string, unknown>,
  ): Promise<TEntity> {
    const { data, error } = await this.supabase
      .from(this.table)
      .insert({ ...values, organization_id: organizationId })
      .select(this.columns)
      .single()
      .overrideTypes<TRow>();

    if (error) {
      throw new Error(`No se pudo crear ${this.label}: ${error.message}`);
    }

    return this.toEntity(data as TRow);
  }

  protected async patch(
    organizationId: string,
    id: string,
    values: Record<string, unknown>,
  ): Promise<TEntity> {
    const { data, error } = await this.supabase
      .from(this.table)
      .update(values)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select(this.columns)
      .single()
      .overrideTypes<TRow>();

    if (error) {
      throw new Error(`No se pudo actualizar ${this.label}: ${error.message}`);
    }

    return this.toEntity(data as TRow);
  }

  /** Archivar es la única forma de retirar algo: nada se borra (convención nº 3). */
  async archive(organizationId: string, id: string): Promise<TEntity> {
    return this.patch(organizationId, id, {
      archived_at: new Date().toISOString(),
    });
  }

  async unarchive(organizationId: string, id: string): Promise<TEntity> {
    return this.patch(organizationId, id, { archived_at: null });
  }
}
