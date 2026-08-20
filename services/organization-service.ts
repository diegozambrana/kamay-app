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
