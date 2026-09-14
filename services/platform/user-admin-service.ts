import type { SupabaseClient } from "@supabase/supabase-js";

import { takeWindow } from "@/lib/pagination";
import type { PlatformMembership, PlatformUser } from "@/lib/platform/users";
import type { Role } from "@/types";

type UserRow = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_platform_admin: boolean;
  memberships: {
    membership_id: string;
    organization_id: string;
    organization_name: string;
    role: Role;
    display_name: string | null;
    archived_at: string | null;
  }[];
};

export type UserListFilters = {
  organizationId?: string;
  query?: string;
  withoutOrganization?: boolean;
  limit?: number;
  userId?: string;
};

/**
 * Las cuentas de la plataforma (KAM-26, design D3).
 *
 * `auth.users` no es legible con sesión; la lista la entrega
 * `platform_list_users()`, que responde solo al super admin y lanza para
 * cualquier otra cuenta. Ninguna consulta de aquí usa el service role.
 */
export class UserAdminService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Las cuentas que piden los filtros. Sin `limit`, todas las que coincidan:
   * se usa solo con un filtro que ya acota (una organización, una cuenta).
   * Las listas de la interfaz siempre pasan un límite (spec
   * `performance-budget` → *No data view loads an entire table*).
   */
  async list(filters: UserListFilters = {}): Promise<PlatformUser[]> {
    const params: Record<string, unknown> = {};
    if (filters.organizationId) params.p_organization_id = filters.organizationId;
    if (filters.query?.trim()) params.p_query = filters.query.trim();
    if (filters.withoutOrganization) params.p_without_organization = true;
    if (filters.limit) params.p_limit = filters.limit;
    if (filters.userId) params.p_user_id = filters.userId;

    const { data, error } = await this.supabase.rpc("platform_list_users", params);

    if (error) {
      throw new Error(`No se pudieron leer las cuentas: ${error.message}`);
    }
    return ((data ?? []) as UserRow[]).map(toUser);
  }

  /** Una ventana de la lista, pidiendo una de más para saber si hay más. */
  async listPage(
    filters: Omit<UserListFilters, "limit" | "userId">,
    limit: number,
  ): Promise<{ rows: PlatformUser[]; hasMore: boolean }> {
    return takeWindow(await this.list({ ...filters, limit: limit + 1 }), limit);
  }

  async get(userId: string): Promise<PlatformUser | null> {
    const [user] = await this.list({ userId });
    return user ?? null;
  }

  /** La cuenta de ese correo exacto, sin importar mayúsculas, o `null`. */
  async findByEmail(email: string): Promise<PlatformUser | null> {
    const target = email.trim().toLowerCase();
    if (!target) return null;
    const matches = await this.list({ query: target, limit: 20 });
    return matches.find((user) => user.email.toLowerCase() === target) ?? null;
  }
}

function toUser(row: UserRow): PlatformUser {
  return {
    id: row.user_id,
    email: row.email,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
    platformAdmin: row.is_platform_admin,
    memberships: (row.memberships ?? []).map(
      (m): PlatformMembership => ({
        membershipId: m.membership_id,
        organizationId: m.organization_id,
        organizationName: m.organization_name,
        role: m.role,
        displayName: m.display_name,
        archivedAt: m.archived_at,
      }),
    ),
  };
}
