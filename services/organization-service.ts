import type { SupabaseClient } from "@supabase/supabase-js";

import type { Organization } from "@/types";

type OrganizationRow = {
  id: string;
  name: string;
  logo_path: string | null;
  currency: string;
  timezone: string;
};

const COLUMNS = "id, name, logo_path, currency, timezone";

/** Por debajo del tope de filas de PostgREST (mil). */
const JOB_PAGE = 500;

/** Acceso a `organizations` desde la sección General de la configuración. */
export class OrganizationService {
  constructor(private readonly supabase: SupabaseClient) {}

  async getById(organizationId: string): Promise<Organization> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select(COLUMNS)
      .eq("id", organizationId)
      .single()
      .overrideTypes<OrganizationRow>();

    if (error) {
      throw new Error(`No se pudo cargar la organización: ${error.message}`);
    }

    return toEntity(data as OrganizationRow);
  }

  /**
   * Todas las organizaciones vivas, para los trabajos programados —con el
   * cliente de service role—: **por páginas hasta agotarlas**. PostgREST
   * devuelve como mucho mil filas por consulta, y un trabajo que leyera de
   * una vez dejaría sin atender, en silencio, a todas las demás (KAM-23).
   * Por antigüedad, para que el orden sea estable entre páginas.
   */
  async listActiveForJobs(): Promise<{ id: string; timezone: string }[]> {
    const organizations: { id: string; timezone: string }[] = [];
    for (let from = 0; ; from += JOB_PAGE) {
      const { data, error } = await this.supabase
        .from("organizations")
        .select("id, timezone")
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + JOB_PAGE - 1)
        .overrideTypes<{ id: string; timezone: string }[]>();

      if (error) {
        throw new Error(`No se pudieron leer las organizaciones: ${error.message}`);
      }
      organizations.push(...(data ?? []));
      if ((data ?? []).length < JOB_PAGE) return organizations;
    }
  }

  /** Solo los datos generales: la membresía y la configuración van aparte. */
  async updateGeneral(
    organizationId: string,
    input: {
      name: string;
      currency: string;
      timezone: string;
      logoPath: string | null;
    },
  ): Promise<Organization> {
    const { data, error } = await this.supabase
      .from("organizations")
      .update({
        name: input.name,
        currency: input.currency,
        timezone: input.timezone,
        logo_path: input.logoPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId)
      .select(COLUMNS)
      .single()
      .overrideTypes<OrganizationRow>();

    if (error) {
      throw new Error(`No se pudo guardar la organización: ${error.message}`);
    }

    return toEntity(data as OrganizationRow);
  }
}

function toEntity(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    logoPath: row.logo_path,
    currency: row.currency,
    timezone: row.timezone,
  };
}
