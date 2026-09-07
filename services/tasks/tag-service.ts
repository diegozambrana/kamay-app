import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeForSearch } from "@/lib/search/normalize";
import type { Tag } from "@/types";

type TagRow = { id: string; organization_id: string; name: string };

function toTag(row: TagRow): Tag {
  return { id: row.id, organizationId: row.organization_id, name: row.name };
}

/**
 * Acceso a `tags`. Las etiquetas son de la organización y se crean al vuelo
 * desde la tarea: obligar a darlas de alta en Configuración antes de usarlas
 * es la forma segura de que nadie las use.
 */
export class TagService {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAll(organizationId: string): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from("tags")
      .select("id, organization_id, name")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })
      .overrideTypes<TagRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar las etiquetas: ${error.message}`);
    }

    return (data ?? []).map(toTag);
  }

  /**
   * Busca por nombre tolerando tildes y mayúsculas.
   *
   * El término se normaliza con la misma función que usa el cliente y se
   * compara contra `search_name`, la columna generada: una sola regla de
   * normalización para los dos lados, como en el catálogo.
   */
  async search(organizationId: string, term: string): Promise<Tag[]> {
    const normalized = normalizeForSearch(term);
    if (!normalized) return this.listAll(organizationId);

    const { data, error } = await this.supabase
      .from("tags")
      .select("id, organization_id, name")
      .eq("organization_id", organizationId)
      .like("search_name", `%${normalized}%`)
      .order("name", { ascending: true })
      .overrideTypes<TagRow[]>();

    if (error) {
      throw new Error(`No se pudieron buscar las etiquetas: ${error.message}`);
    }

    return (data ?? []).map(toTag);
  }

  /**
   * Devuelve los identificadores de estas etiquetas, creando las que falten.
   *
   * La comparación para reutilizar es **normalizada**: quien escribe
   * "hornada-07" cuando ya existe "Hornada-07" no debe crear una segunda. Lo
   * que se guarda, en cambio, es lo que la persona escribió la primera vez —
   * `search_name` sirve para encontrar, `name` para mostrar.
   */
  async resolveNames(
    organizationId: string,
    names: string[],
  ): Promise<string[]> {
    const wanted = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    if (wanted.length === 0) return [];

    const existing = await this.listAll(organizationId);
    const byNormalized = new Map(
      existing.map((tag) => [normalizeForSearch(tag.name), tag.id]),
    );

    const ids: string[] = [];
    const missing: string[] = [];

    for (const name of wanted) {
      const found = byNormalized.get(normalizeForSearch(name));
      if (found) ids.push(found);
      else missing.push(name);
    }

    if (missing.length === 0) return ids;

    const { data, error } = await this.supabase
      .from("tags")
      .insert(
        missing.map((name) => ({ organization_id: organizationId, name })),
      )
      .select("id, organization_id, name")
      .overrideTypes<TagRow[]>();

    if (error) {
      throw new Error(`No se pudieron crear las etiquetas: ${error.message}`);
    }

    return [...ids, ...(data ?? []).map((row) => row.id)];
  }
}
