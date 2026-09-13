import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContactFormValues } from "@/lib/catalog/schema";
import { normalizeForSearch } from "@/lib/search/normalize";
import type { Contact, ContactRoleFilter } from "@/types";
import { chunk } from "@/lib/pagination";

type ContactRow = {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_supplier: boolean;
  is_customer: boolean;
  notes: string | null;
  archived_at: string | null;
};

const COLUMNS =
  "id, organization_id, name, phone, email, address, is_supplier, is_customer, notes, archived_at";

export type ContactFilters = {
  role?: ContactRoleFilter;
  search?: string;
  includeArchived?: boolean;
  /**
   * Cuántas filas traer como máximo. La pantalla del directorio pide una
   * ventana (`limit + 1` para saber si hay más); los selectores de los
   * formularios, por ahora, el directorio entero.
   */
  limit?: number;
};

/**
 * Acceso a `contacts`. El filtro por rol no es excluyente: quien es proveedor
 * y cliente a la vez aparece en las dos listas, que es como lo pide el
 * directorio (V13).
 */
export class ContactService {
  constructor(private readonly supabase: SupabaseClient) {}

  private toEntity(row: ContactRow): Contact {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      isSupplier: row.is_supplier,
      isCustomer: row.is_customer,
      notes: row.notes,
      archivedAt: row.archived_at,
    };
  }

  async list(
    organizationId: string,
    filters: ContactFilters = {},
  ): Promise<Contact[]> {
    let query = this.supabase
      .from("contacts")
      .select(COLUMNS)
      .eq("organization_id", organizationId);

    if (filters.role === "supplier") query = query.eq("is_supplier", true);
    if (filters.role === "customer") query = query.eq("is_customer", true);

    if (!filters.includeArchived) query = query.is("archived_at", null);

    const term = normalizeForSearch(filters.search ?? "");
    if (term !== "") {
      query = query.like("search_name", `%${term}%`);
    }

    let ordered = query.order("name", { ascending: true });
    if (filters.limit !== undefined) ordered = ordered.limit(filters.limit);

    const { data, error } = await ordered.overrideTypes<ContactRow[]>();

    if (error) {
      throw new Error(`No se pudo cargar el directorio: ${error.message}`);
    }

    return (data ?? []).map((row) => this.toEntity(row as ContactRow));
  }

  /**
   * El nombre de cada contacto pedido, archivados incluidos —un pedido viejo
   * sigue nombrando a su cliente aunque ya no esté vigente—.
   *
   * Para las pantallas que solo necesitan nombrar lo que muestran: pedir el
   * directorio entero para eso crecía con él (KAM-23, spec
   * `performance-budget`). Va en tandas por la misma razón que los totales.
   */
  async namesFor(organizationId: string, ids: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();

    const batches = await Promise.all(
      chunk(unique).map((batch) =>
        this.supabase
          .from("contacts")
          .select("id, name")
          .eq("organization_id", organizationId)
          .in("id", batch),
      ),
    );
    const failed = batches.find((batch) => batch.error);
    if (failed?.error) {
      throw new Error(`No se pudo cargar el directorio: ${failed.error.message}`);
    }

    return new Map(
      batches.flatMap((batch) =>
        (batch.data ?? []).map((row) => [row.id as string, row.name as string] as const),
      ),
    );
  }

  async findById(organizationId: string, id: string): Promise<Contact | null> {
    const { data, error } = await this.supabase
      .from("contacts")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ContactRow | null>();

    if (error) {
      throw new Error(`No se pudo cargar el contacto: ${error.message}`);
    }

    return data ? this.toEntity(data as ContactRow) : null;
  }

  async create(
    organizationId: string,
    id: string,
    input: ContactFormValues,
  ): Promise<Contact> {
    const { data, error } = await this.supabase
      .from("contacts")
      .insert({
        id,
        organization_id: organizationId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        is_supplier: input.isSupplier,
        is_customer: input.isCustomer,
      })
      .select(COLUMNS)
      .single()
      .overrideTypes<ContactRow>();

    if (error) {
      throw new Error(`No se pudo crear el contacto: ${error.message}`);
    }

    return this.toEntity(data as ContactRow);
  }

  async update(
    organizationId: string,
    id: string,
    input: ContactFormValues,
  ): Promise<Contact> {
    const { data, error } = await this.supabase
      .from("contacts")
      .update({
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        is_supplier: input.isSupplier,
        is_customer: input.isCustomer,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
      .select(COLUMNS)
      .single()
      .overrideTypes<ContactRow>();

    if (error) {
      throw new Error(`No se pudo guardar el contacto: ${error.message}`);
    }

    return this.toEntity(data as ContactRow);
  }

  async setArchived(
    organizationId: string,
    id: string,
    archived: boolean,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("contacts")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(
        `No se pudo ${archived ? "archivar" : "desarchivar"} el contacto: ${error.message}`,
      );
    }
  }
}
