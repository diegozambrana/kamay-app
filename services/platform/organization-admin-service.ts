import type { SupabaseClient } from "@supabase/supabase-js";

import { takeWindow } from "@/lib/pagination";
import type { Role } from "@/types";

type MembershipEmbed = {
  role: Role;
  display_name: string | null;
  archived_at: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  created_at: string;
  archived_at: string | null;
  memberships: MembershipEmbed[] | null;
};

/** Una fila de la vista *Organizaciones*. */
export type OrganizationSummary = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  createdAt: string;
  archivedAt: string | null;
  /** Nombres visibles de sus dueños activos. */
  owners: string[];
  /** Cuántas membresías activas tiene. */
  activeMembers: number;
};

export type OrganizationInput = {
  name: string;
  currency: string;
  timezone: string;
};

const COLUMNS =
  "id, name, currency, timezone, created_at, archived_at, memberships (role, display_name, archived_at)";

/**
 * Las organizaciones vistas desde la plataforma (KAM-26): todas, con sus
 * dueños y su tamaño, crear una y editar sus datos.
 *
 * Los recuentos se calculan al leer y no se guardan en ninguna parte
 * (convención nº 4). El acceso lo decide RLS: el super admin ve todas porque
 * `is_member()` lo reconoce, no porque este servicio use otro cliente.
 */
export class OrganizationAdminService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Una ventana de organizaciones por nombre, con búsqueda (spec
   * `performance-budget` → *No data view loads an entire table*): pide una de
   * más para saber si hay más.
   */
  async listPage(
    query: string,
    limit: number,
  ): Promise<{ rows: OrganizationSummary[]; hasMore: boolean }> {
    let request = this.supabase.from("organizations").select(COLUMNS);
    const needle = query.trim();
    if (needle) request = request.ilike("name", `%${needle}%`);

    const { data, error } = await request
      .order("name", { ascending: true })
      .limit(limit + 1)
      .overrideTypes<OrganizationRow[]>();

    if (error) {
      throw new Error(`No se pudieron leer las organizaciones: ${error.message}`);
    }
    return takeWindow((data ?? []).map(toSummary), limit);
  }

  async get(organizationId: string): Promise<OrganizationSummary | null> {
    const { data, error } = await this.supabase
      .from("organizations")
      .select(COLUMNS)
      .eq("id", organizationId)
      .maybeSingle()
      .overrideTypes<OrganizationRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar la organización: ${error.message}`);
    }
    return data ? toSummary(data as OrganizationRow) : null;
  }

  /**
   * Crea la organización con su línea compartida y sus estados mínimos, todo
   * o nada, en `create_organization()` (design D4). Devuelve su id.
   */
  async create(input: OrganizationInput): Promise<string> {
    const { data, error } = await this.supabase.rpc("create_organization", {
      p_name: input.name,
      p_currency: input.currency,
      p_timezone: input.timezone,
    });

    if (error) {
      throw new Error(`No se pudo crear la organización: ${error.message}`);
    }
    return data as string;
  }

  /** Nombre, moneda y zona horaria; el logo y la configuración van aparte. */
  async update(organizationId: string, input: OrganizationInput): Promise<void> {
    const { error } = await this.supabase
      .from("organizations")
      .update({
        name: input.name,
        currency: input.currency,
        timezone: input.timezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId);

    if (error) {
      throw new Error(`No se pudo guardar la organización: ${error.message}`);
    }
  }
}

function toSummary(row: OrganizationRow): OrganizationSummary {
  const active = (row.memberships ?? []).filter((m) => m.archived_at === null);
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    timezone: row.timezone,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    owners: active
      .filter((m) => m.role === "owner")
      .map((m) => m.display_name?.trim() || "Sin nombre"),
    activeMembers: active.length,
  };
}
