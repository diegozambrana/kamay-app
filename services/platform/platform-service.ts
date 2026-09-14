import type { SupabaseClient } from "@supabase/supabase-js";

import { OPEN_WORK_CAP, takeWindow } from "@/lib/pagination";
import type { Organization } from "@/types";

type OrganizationRow = {
  id: string;
  name: string;
  logo_path: string | null;
  currency: string;
  timezone: string;
};

/** Una organización tal como la ofrece el selector del menú lateral. */
export type OrganizationOption = { id: string; name: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lo que la sesión necesita saber del administrador de la plataforma
 * (KAM-26): si la cuenta lo es, y a qué organizaciones puede entrar.
 *
 * Nada de esto salta RLS: `is_platform_admin()` pregunta por la fila propia,
 * y las organizaciones que ve el super admin las ve porque `is_member()` lo
 * reconoce.
 */
export class PlatformService {
  constructor(private readonly supabase: SupabaseClient) {}

  async isPlatformAdmin(): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("is_platform_admin");
    if (error) {
      throw new Error(`No se pudo comprobar el acceso de plataforma: ${error.message}`);
    }
    return data === true;
  }

  /**
   * La organización que nombra la cookie, si existe y no está archivada. Una
   * cookie que no es un `uuid` no llega a la base: Postgres respondería con un
   * error de sintaxis en lugar de "no existe".
   */
  async findActiveOrganization(organizationId: string): Promise<Organization | null> {
    if (!UUID.test(organizationId)) return null;

    const { data, error } = await this.supabase
      .from("organizations")
      .select("id, name, logo_path, currency, timezone")
      .eq("id", organizationId)
      .is("archived_at", null)
      .maybeSingle()
      .overrideTypes<OrganizationRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar la organización: ${error.message}`);
    }
    if (!data) return null;

    const row = data as OrganizationRow;
    return {
      id: row.id,
      name: row.name,
      logoPath: row.logo_path,
      currency: row.currency,
      timezone: row.timezone,
    };
  }

  /**
   * Las organizaciones vivas, por nombre: las opciones del selector y de la
   * asignación. Con tope —`OPEN_WORK_CAP`, la misma red de seguridad de los
   * tableros—: una plataforma tiene decenas de talleres, pero ninguna vista
   * pide una tabla entera. Si hay más, lo dice `hasMore` y la vista manda a
   * *Organizaciones*, que busca y pagina.
   */
  async listActiveOrganizations(
    cap = OPEN_WORK_CAP,
  ): Promise<{ organizations: OrganizationOption[]; hasMore: boolean }> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("id, name")
      .is("archived_at", null)
      .order("name", { ascending: true })
      .limit(cap + 1)
      .overrideTypes<OrganizationOption[]>();

    if (error) {
      throw new Error(`No se pudieron leer las organizaciones: ${error.message}`);
    }
    const { rows, hasMore } = takeWindow(data ?? [], cap);
    return { organizations: rows, hasMore };
  }
}
