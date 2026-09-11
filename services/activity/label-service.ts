import type { SupabaseClient } from "@supabase/supabase-js";

import { referencedIds } from "@/lib/activity/diff";
import { fieldSpec } from "@/lib/activity/fields";

/**
 * Cómo se llama cada cosa que la bitácora menciona.
 *
 * Un evento guarda identificadores: el registro afectado (`record_id`), la
 * persona que lo hizo (`actor_id`) y, dentro del detalle, las referencias a
 * otros registros (`status_id`, `contact_id`…). En pantalla ninguno de esos
 * `uuid` puede aparecer, así que alguien tiene que traducirlos.
 *
 * **Una consulta por tabla distinta, no una por evento** (design D4). Una
 * página son cincuenta eventos que tocan como mucho ocho tablas; resolverlos
 * de uno en uno serían cincuenta viajes para pintar una lista.
 *
 * Lo que hasta ahora hacía a mano `app/(app)/dashboard/page.tsx` —y solo para
 * los pedidos, dejando al resto de las tablas sin rótulo— vive aquí.
 */

/** Qué columna nombra a un registro en cada tabla que tiene rótulo humano. */
const LABEL_COLUMNS: Record<string, string> = {
  orders: "code",
  items: "name",
  item_variants: "name",
  contacts: "name",
  tasks: "title",
  business_lines: "name",
  statuses: "name",
  sales_channels: "name",
  expense_categories: "name",
  units: "name",
  tags: "name",
  organizations: "name",
  expenses: "note",
  invitations: "email",
  attachments: "file_name",
  memberships: "display_name",
};

/**
 * Las tablas sin rótulo: una línea de pedido, un movimiento de inventario o un
 * vínculo de tarea no tienen nombre propio. Su evento se cuenta sin él, que es
 * preferible a enseñar un identificador.
 */
export function hasLabel(tableName: string): boolean {
  return tableName in LABEL_COLUMNS;
}

/** El `#142` del pedido: el número se presenta con almohadilla, el resto no. */
function formatLabel(tableName: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return tableName === "orders" ? `#${value}` : String(value);
}

export type LabelMap = ReadonlyMap<string, string>;

export class LabelService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Los rótulos de los registros que estos eventos afectan.
   *
   * Filtra por `organization_id` explícitamente aunque RLS ya lo haga
   * (convención nº 2): un identificador de otra organización no se resuelve ni
   * por accidente.
   */
  async forRecords(
    organizationId: string,
    events: readonly { tableName: string; recordId: string }[],
  ): Promise<LabelMap> {
    const byTable = new Map<string, Set<string>>();

    for (const event of events) {
      if (!hasLabel(event.tableName)) continue;
      const ids = byTable.get(event.tableName) ?? new Set<string>();
      ids.add(event.recordId);
      byTable.set(event.tableName, ids);
    }

    return this.resolve(organizationId, byTable);
  }

  /**
   * Los nombres que el detalle de estos eventos necesita: los registros a los
   * que apuntan sus campos de referencia, y las personas de sus campos de
   * usuario.
   *
   * Las personas no salen de una tabla con `organization_id` propio sino de
   * `memberships`, así que se piden aparte y por su `user_id`.
   */
  async forDetails(
    organizationId: string,
    events: readonly {
      tableName: string;
      changes: Record<string, unknown> | null;
    }[],
  ): Promise<LabelMap> {
    const byTable = new Map<string, Set<string>>();
    const users = new Set<string>();

    for (const event of events) {
      for (const { table, id } of referencesOf(event)) {
        if (table === null) {
          users.add(id);
          continue;
        }
        if (!hasLabel(table)) continue;
        const ids = byTable.get(table) ?? new Set<string>();
        ids.add(id);
        byTable.set(table, ids);
      }
    }

    const [records, people] = await Promise.all([
      this.resolve(organizationId, byTable),
      this.people(organizationId, [...users]),
    ]);

    return new Map([...records, ...people]);
  }

  /** Los nombres de las personas del equipo, por su identificador de usuario. */
  async people(
    organizationId: string,
    userIds: readonly string[],
  ): Promise<LabelMap> {
    if (userIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from("memberships")
      .select("user_id, display_name")
      .eq("organization_id", organizationId)
      .in("user_id", [...userIds]);

    if (error) {
      throw new Error(`No se pudieron cargar las personas: ${error.message}`);
    }

    const names = new Map<string, string>();
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const label = formatLabel("memberships", row.display_name);
      if (label) names.set(row.user_id as string, label);
    }
    return names;
  }

  /** Una consulta por tabla, todas en paralelo. */
  private async resolve(
    organizationId: string,
    byTable: ReadonlyMap<string, Set<string>>,
  ): Promise<LabelMap> {
    const results = await Promise.all(
      [...byTable].map(async ([table, ids]) => {
        const column = LABEL_COLUMNS[table];
        // `organizations` no tiene `organization_id`: su clave **es** la
        // organización. Filtrar por la columna genérica ahí devuelve un error
        // de columna inexistente, y basta con que una página de la bitácora
        // contenga el alta de la propia organización para tumbarla.
        const scope = table === "organizations" ? "id" : "organization_id";

        const { data, error } = await this.supabase
          .from(table)
          .select(`id, ${column}`)
          .eq(scope, organizationId)
          .in("id", [...ids]);

        if (error) {
          throw new Error(
            `No se pudieron cargar los rótulos de ${table}: ${error.message}`,
          );
        }

        return ((data ?? []) as unknown as Record<string, unknown>[]).map(
          (row) => [row.id as string, formatLabel(table, row[column])] as const,
        );
      }),
    );

    const names = new Map<string, string>();
    for (const [id, label] of results.flat()) {
      if (label) names.set(id, label);
    }
    return names;
  }
}

/**
 * Las referencias de un evento: `{table, id}` para un registro, `{table: null}`
 * para una persona.
 */
function referencesOf(event: {
  tableName: string;
  changes: Record<string, unknown> | null;
}): { table: string | null; id: string }[] {
  return referencedIds(event.tableName, event.changes).map((id) => ({
    table: referenceTableOf(event.tableName, id, event.changes),
    id,
  }));
}

/**
 * A qué tabla apunta un identificador concreto del detalle.
 *
 * `referencedIds` devuelve los valores; aquí se recupera de qué campo salió
 * cada uno para saber su destino. `null` significa que es una persona.
 */
function referenceTableOf(
  tableName: string,
  id: string,
  changes: Record<string, unknown> | null,
): string | null {
  if (!changes) return null;

  for (const [column, raw] of Object.entries(changes)) {
    const values =
      typeof raw === "object" && raw !== null && !Array.isArray(raw)
        ? Object.values(raw as Record<string, unknown>)
        : [raw];

    if (!values.includes(id)) continue;

    const spec = fieldSpec(tableName, column);
    if (spec?.kind === "user") return null;
    if (spec?.kind === "reference") return spec.references ?? null;
  }
  return null;
}

/** Un `uuid` pegado tal cual en la búsqueda. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * De lo que la persona escribió al `record_id` que la consulta necesita.
 *
 * La búsqueda es **por identificador del registro**, no por texto libre dentro
 * de `changes`: el índice GIN existe, pero su coste depende del contenido del
 * `jsonb` y pondría el criterio de los 2 segundos a merced del dato (decisión
 * del usuario, supuesto 3 de la propuesta).
 *
 * Devuelve `undefined` cuando no hay búsqueda, y `null` cuando la hay pero no
 * corresponde a ningún registro — que no es un error, es el estado «ningún
 * resultado» con una consulta que no puede devolver nada.
 */
export async function resolveSearch(
  supabase: SupabaseClient,
  organizationId: string,
  query: string,
): Promise<string | null | undefined> {
  const term = query.trim();
  if (!term) return undefined;

  // Un identificador interno pegado: se usa tal cual, sin consultar.
  if (UUID.test(term)) return term;

  // El número con el que se muestra un pedido: «142», con o sin almohadilla.
  const code = Number(term.replace(/^#/, ""));
  if (Number.isSafeInteger(code) && code > 0) {
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo resolver la búsqueda: ${error.message}`);
    }
    if (data) return (data as { id: string }).id;
  }

  return null;
}
