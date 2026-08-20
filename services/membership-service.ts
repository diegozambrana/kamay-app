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
}
