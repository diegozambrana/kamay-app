import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
} from "@/lib/invitations/token";
import type { Invitation, MemberRow, Role } from "@/types";

type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: Role;
  expires_at: string;
  accepted_at: string | null;
  archived_at: string | null;
  created_at: string;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: Role;
  display_name: string | null;
  archived_at: string | null;
};

const INVITATION_COLUMNS =
  "id, organization_id, email, role, expires_at, accepted_at, archived_at, created_at";
const MEMBERSHIP_COLUMNS =
  "id, organization_id, user_id, role, display_name, archived_at";

/** Acceso a `invitations` y a la gestión de `memberships` desde configuración. */
export class InvitationService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Lo que la sección Usuarios y roles muestra: ni aceptadas ni revocadas. */
  async listPending(organizationId: string): Promise<Invitation[]> {
    const { data, error } = await this.supabase
      .from("invitations")
      .select(INVITATION_COLUMNS)
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .overrideTypes<InvitationRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las invitaciones: ${error.message}`);
    }

    return (data ?? []).map(toInvitation);
  }

  /**
   * Crea la invitación y devuelve el token **una sola vez**: en la base queda
   * su hash, así que este es el único momento en que se puede armar el enlace.
   */
  async create(
    organizationId: string,
    input: { email: string; role: Role; invitedBy: string },
  ): Promise<{ invitation: Invitation; token: string }> {
    const token = generateInvitationToken();

    const { data, error } = await this.supabase
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email: input.email,
        role: input.role,
        token_hash: hashInvitationToken(token),
        expires_at: invitationExpiry(),
        invited_by: input.invitedBy,
      })
      .select(INVITATION_COLUMNS)
      .single()
      .overrideTypes<InvitationRow>();

    if (error) {
      throw new Error(`No se pudo crear la invitación: ${error.message}`);
    }

    return { invitation: toInvitation(data as InvitationRow), token };
  }

  /** Revocar es archivar: la invitación deja de servir pero queda su rastro. */
  async revoke(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("invitations")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudo revocar la invitación: ${error.message}`);
    }
  }

  /**
   * Canjea el token. La validación entera vive en `accept_invitation()`, que
   * responde lo mismo ante cualquier fallo: aquí no se interpreta el motivo.
   */
  async accept(token: string): Promise<string> {
    const { data, error } = await this.supabase.rpc("accept_invitation", {
      p_token: token,
    });

    if (error) {
      throw new Error("La invitación no es válida o ya fue utilizada.");
    }

    return data as string;
  }

  async listMembers(organizationId: string): Promise<MemberRow[]> {
    const { data, error } = await this.supabase
      .from("memberships")
      .select(MEMBERSHIP_COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .overrideTypes<MembershipRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las membresías: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      displayName: row.display_name,
      archivedAt: row.archived_at,
    }));
  }

  async changeRole(
    organizationId: string,
    membershipId: string,
    role: Role,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("memberships")
      .update({ role })
      .eq("id", membershipId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudo cambiar el rol: ${error.message}`);
    }
  }

  /**
   * Archivar corta el acceso. Si es el último dueño activo, la base lo rechaza
   * y el mensaje de Postgres es el que ve el usuario.
   */
  async archiveMembership(
    organizationId: string,
    membershipId: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("memberships")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", membershipId)
      .eq("organization_id", organizationId);

    if (error) {
      throw new Error(`No se pudo archivar la membresía: ${error.message}`);
    }
  }
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}
