import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/types";

export type Assignment = {
  organizationId: string;
  role: Role;
  displayName: string;
};

/**
 * Qué pasó con cada organización de una asignación. Una asignación no es
 * todo-o-nada: que la cuenta ya perteneciera a una no oculta las demás (spec
 * `platform-administration` → *One failing assignment does not hide the
 * others*).
 */
export type AssignmentOutcome =
  | { organizationId: string; status: "created" | "restored" | "already_member" }
  | { organizationId: string; status: "failed"; error: string };

type ExistingRow = { id: string; archived_at: string | null };

/**
 * El equipo de cualquier organización, gestionado por el super admin
 * (KAM-26, design D9).
 *
 * Con sesión y bajo RLS: `memberships` permite `insert` y `update` a quien
 * `is_owner()` reconoce, y eso incluye al super admin. El disparador
 * `guard_last_owner` sigue protegiendo al último dueño, y la bitácora marca
 * cada cambio como del administrador de la plataforma.
 */
export class MembershipAdminService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Agrega la cuenta a cada organización, o reactiva la membresía archivada. */
  async assign(userId: string, assignments: Assignment[]): Promise<AssignmentOutcome[]> {
    const outcomes: AssignmentOutcome[] = [];
    for (const assignment of assignments) {
      outcomes.push(await this.assignOne(userId, assignment));
    }
    return outcomes;
  }

  private async assignOne(userId: string, assignment: Assignment): Promise<AssignmentOutcome> {
    const { organizationId, role, displayName } = assignment;

    const { data: existing, error: readError } = await this.supabase
      .from("memberships")
      .select("id, archived_at")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle()
      .overrideTypes<ExistingRow | null>();

    if (readError) return failed(organizationId, readError.message);

    const row = existing as ExistingRow | null;
    if (row && row.archived_at === null) {
      return { organizationId, status: "already_member" };
    }

    if (row) {
      const { error } = await this.supabase
        .from("memberships")
        .update({ archived_at: null, role, display_name: displayName })
        .eq("id", row.id)
        .eq("organization_id", organizationId);
      return error ? failed(organizationId, error.message) : { organizationId, status: "restored" };
    }

    const { error } = await this.supabase.from("memberships").insert({
      organization_id: organizationId,
      user_id: userId,
      role,
      display_name: displayName,
    });
    return error ? failed(organizationId, error.message) : { organizationId, status: "created" };
  }

  async setDisplayName(
    organizationId: string,
    membershipId: string,
    displayName: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("memberships")
      .update({ display_name: displayName })
      .eq("id", membershipId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudo cambiar el nombre: ${error.message}`);
    }
  }

  /** Devolver el acceso a una membresía archivada, con el rol que tenía. */
  async restore(organizationId: string, membershipId: string): Promise<void> {
    const { error } = await this.supabase
      .from("memberships")
      .update({ archived_at: null })
      .eq("id", membershipId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudo restaurar el acceso: ${error.message}`);
    }
  }
}

function failed(organizationId: string, error: string): AssignmentOutcome {
  return { organizationId, status: "failed", error };
}
