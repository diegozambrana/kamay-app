import type { SupabaseClient } from "@supabase/supabase-js";

type OrganizationToolRow = {
  id: string;
  organization_id: string;
  slug: string;
  config: Record<string, unknown>;
  archived_at: string | null;
};

/** Una fila de `organization_tools`: qué herramienta, con qué parámetros. */
export type OrganizationTool = {
  id: string;
  organizationId: string;
  slug: string;
  /** Parámetros tal como se guardaron: los valida el esquema del manifiesto. */
  config: Record<string, unknown>;
  archivedAt: string | null;
};

const COLUMNS = "id, organization_id, slug, config, archived_at";

function toEntity(row: OrganizationToolRow): OrganizationTool {
  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    config: row.config ?? {},
    archivedAt: row.archived_at,
  };
}

/**
 * KAM-27 · Acceso a `organization_tools` (spec `tenant-tools` → *La activación
 * de herramientas se guarda por organización*; design D4).
 *
 * La tabla es **solo de la dueña**: los parámetros pueden llevar tarifas y
 * márgenes. Por eso hay dos lecturas distintas:
 * - `activeSlugs` va por la función `active_tool_slugs`, que cualquier miembro
 *   puede llamar y que devuelve únicamente identificadores;
 * - todo lo demás lee la tabla, y al ayudante la RLS le devuelve cero filas.
 *
 * Este servicio no sabe qué herramientas existen: eso es del registro en
 * código (`tools/registry.ts`). Aquí un slug es solo texto.
 */
export class OrganizationToolService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Los identificadores de las herramientas activas. Para cualquier miembro. */
  async activeSlugs(organizationId: string): Promise<string[]> {
    const { data, error } = await this.supabase.rpc("active_tool_slugs", {
      p_organization_id: organizationId,
    });
    if (error) {
      throw new Error(`No se pudieron cargar las herramientas activas: ${error.message}`);
    }
    return ((data ?? []) as unknown[]).map(String);
  }

  /** Todas las filas, activas y desactivadas. Solo devuelve algo a la dueña. */
  async list(organizationId: string): Promise<OrganizationTool[]> {
    const { data, error } = await this.supabase
      .from("organization_tools")
      .select(COLUMNS)
      // Convención nº 2: la organización, explícita, aunque RLS ya filtre.
      .eq("organization_id", organizationId)
      .order("slug", { ascending: true });

    if (error) throw new Error(`No se pudieron cargar las herramientas: ${error.message}`);
    return ((data ?? []) as OrganizationToolRow[]).map(toEntity);
  }

  /** La fila de una herramienta, esté activa o no. `null` si nunca se activó. */
  async findBySlug(organizationId: string, slug: string): Promise<OrganizationTool | null> {
    const { data, error } = await this.supabase
      .from("organization_tools")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("slug", slug)
      .maybeSingle()
      .overrideTypes<OrganizationToolRow | null>();

    if (error) throw new Error(`No se pudo cargar la herramienta: ${error.message}`);
    return data ? toEntity(data as OrganizationToolRow) : null;
  }

  /** Los parámetros guardados de una herramienta **activa**, o `null`. */
  async getActiveConfig(
    organizationId: string,
    slug: string,
  ): Promise<Record<string, unknown> | null> {
    const tool = await this.findBySlug(organizationId, slug);
    return tool && tool.archivedAt === null ? tool.config : null;
  }

  /**
   * Activa. Si la organización ya tuvo la herramienta, **la reactiva con los
   * parámetros que tenía** (spec → *Desactivar conserva los parámetros*); si
   * no, nace con los valores por defecto de su manifiesto.
   */
  async activate(
    organizationId: string,
    slug: string,
    defaults: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.findBySlug(organizationId, slug);

    if (existing) {
      if (existing.archivedAt === null) return;
      await this.patch(organizationId, slug, { archived_at: null });
      return;
    }

    const { error } = await this.supabase
      .from("organization_tools")
      .insert({ organization_id: organizationId, slug, config: defaults });
    if (error) throw new Error(`No se pudo activar la herramienta: ${error.message}`);
  }

  /** Desactivar es archivar: la fila y sus parámetros se quedan. */
  async deactivate(organizationId: string, slug: string): Promise<void> {
    await this.patch(organizationId, slug, { archived_at: new Date().toISOString() });
  }

  async updateConfig(
    organizationId: string,
    slug: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    await this.patch(organizationId, slug, { config });
  }

  private async patch(
    organizationId: string,
    slug: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("organization_tools")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("slug", slug)
      .select("id");

    if (error) throw new Error(`No se pudo guardar la herramienta: ${error.message}`);
    // Bajo RLS, escribir sobre una fila que no se ve no lanza: afecta cero
    // filas. Sin esta comprobación, un rechazo pasaría por un guardado.
    if (!data || (data as unknown[]).length === 0) {
      throw new Error("No se pudo guardar la herramienta: no está a tu alcance.");
    }
  }
}
