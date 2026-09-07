import type { SupabaseClient } from "@supabase/supabase-js";

import type { MembershipWithOrganization, Role } from "@/types";

type MembershipRow = {
  id: string;
  organization_id: string;
  role: Role;
  display_name: string | null;
  organization: {
    id: string;
    name: string;
    logo_path: string | null;
    currency: string;
    timezone: string;
    archived_at: string | null;
  } | null;
};

/** Acceso a `memberships`. Todo acceso a Supabase vive en services/. */
export class MembershipService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Membresías activas del usuario, con su organización (no archivada). */
  async listActiveForUser(userId: string): Promise<MembershipWithOrganization[]> {
    const { data, error } = await this.supabase
      .from("memberships")
      .select(
        "id, organization_id, role, display_name, organization:organizations!inner (id, name, logo_path, currency, timezone, archived_at)",
      )
      .eq("user_id", userId)
      .is("archived_at", null)
      .overrideTypes<MembershipRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las membresías: ${error.message}`);
    }

    return (data ?? [])
      .filter((row) => row.organization && row.organization.archived_at === null)
      .map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        role: row.role,
        displayName: row.display_name,
        organization: {
          id: row.organization!.id,
          name: row.organization!.name,
          logoPath: row.organization!.logo_path,
          currency: row.organization!.currency,
          timezone: row.organization!.timezone,
        },
      }));
  }

  /**
   * Las líneas declaradas de cada membresía de la organización, indexadas por
   * membresía.
   *
   * Una membresía **ausente del mapa no está restringida**: alcanza todas las
   * líneas. La regla vive en `has_line_access()` dentro de la base (KAM-15,
   * design D4); aquí solo se lee para pintar la pantalla, nunca para decidir
   * qué se ve.
   */
  async listLinesByMembership(
    organizationId: string,
  ): Promise<Map<string, string[]>> {
    const { data, error } = await this.supabase
      .from("membership_lines")
      .select("membership_id, business_line_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .overrideTypes<{ membership_id: string; business_line_id: string }[]>();

    if (error) {
      throw new Error(
        `No se pudieron cargar las líneas del equipo: ${error.message}`,
      );
    }

    const byMembership = new Map<string, string[]>();
    for (const row of data ?? []) {
      const lines = byMembership.get(row.membership_id) ?? [];
      lines.push(row.business_line_id);
      byMembership.set(row.membership_id, lines);
    }
    return byMembership;
  }

  /**
   * Deja la membresía con exactamente las líneas indicadas.
   *
   * Una lista vacía la deja sin ninguna línea declarada, que es justamente
   * «alcanza todas»: quitar la última restricción devuelve el acceso completo,
   * no lo retira.
   *
   * Retirar una línea **archiva** su fila, nunca la borra (convención nº 3):
   * quién pudo ver qué, y desde cuándo, es lo que un permiso tiene que poder
   * responder después. Devolver una línea retirada desarchiva la fila que ya
   * existía, y por eso el índice único es parcial.
   */
  async setLines(
    organizationId: string,
    membershipId: string,
    businessLineIds: string[],
  ): Promise<void> {
    const wanted = [...new Set(businessLineIds)];

    const { data, error: read } = await this.supabase
      .from("membership_lines")
      .select("business_line_id")
      .eq("membership_id", membershipId)
      .eq("organization_id", organizationId)
      .overrideTypes<{ business_line_id: string }[]>();

    if (read) {
      throw new Error(`No se pudieron leer las líneas: ${read.message}`);
    }

    const known = new Set((data ?? []).map((row) => row.business_line_id));

    // Se archiva todo lo vigente y se desarchiva lo que sigue queriéndose, en
    // ese orden: así una línea que se conserva nunca queda un instante fuera.
    const { error: archived } = await this.supabase
      .from("membership_lines")
      .update({ archived_at: new Date().toISOString() })
      .eq("membership_id", membershipId)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    if (archived) {
      throw new Error(`No se pudieron retirar las líneas: ${archived.message}`);
    }

    const revived = wanted.filter((id) => known.has(id));
    if (revived.length > 0) {
      const { error } = await this.supabase
        .from("membership_lines")
        .update({ archived_at: null })
        .eq("membership_id", membershipId)
        .eq("organization_id", organizationId)
        .in("business_line_id", revived);

      if (error) {
        throw new Error(`No se pudieron devolver las líneas: ${error.message}`);
      }
    }

    const fresh = wanted.filter((id) => !known.has(id));
    if (fresh.length > 0) {
      const { error } = await this.supabase.from("membership_lines").insert(
        fresh.map((businessLineId) => ({
          membership_id: membershipId,
          business_line_id: businessLineId,
          organization_id: organizationId,
        })),
      );

      if (error) {
        throw new Error(`No se pudieron asignar las líneas: ${error.message}`);
      }
    }
  }
}
