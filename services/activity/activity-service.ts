import type { SupabaseClient } from "@supabase/supabase-js";

import { ANY, type ActivityFilters, rangeInstants } from "@/lib/activity/filters";
import { ALL_LINES } from "@/types";
import type { ActivityEntry } from "@/types";

/**
 * Un evento con lo que hace falta para redactarlo fuera del contexto de un
 * registro concreto: la tabla y el registro, que el historial de una pantalla
 * de detalle ya sabe y esta lista no.
 */
export type RecentActivityEntry = ActivityEntry & {
  tableName: string;
  recordId: string;
  businessLineId: string | null;
  /** 'mobile' | 'desktop' | 'external'. `null` en todo evento anterior a KAM-22. */
  origin: string | null;
};

/** Una página de la bitácora y por dónde seguir. */
export type ActivityPage = {
  entries: RecentActivityEntry[];
  /**
   * El cursor de la página siguiente, o `null` si esta fue la última.
   *
   * No se acompaña de un total a propósito: contar las filas que cumplen el
   * filtro sobre cien mil eventos es un recorrido completo, y es la mitad del
   * presupuesto de los 2 segundos gastada en un número que nadie mira.
   */
  nextCursor: string | null;
};

/**
 * El tope de filas lo impone el servicio, no quien llama. Una lista de "qué
 * pasó" sin techo es una consulta de decenas de miles de filas esperando a
 * que la bitácora crezca —y va a crecer: es el grupo de datos de mayor
 * volumen del sistema (§9)—.
 */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 5;

/**
 * Cuántos eventos trae una página de V23.
 *
 * Es un techo del servicio y no del que llama: una lista sin techo sobre la
 * bitácora —el grupo de datos de mayor volumen del sistema (§9)— es una
 * consulta de decenas de miles de filas esperando su momento.
 */
export const PAGE_SIZE = 50;

/** Las columnas que toda lectura de la bitácora pide. Una sola vez. */
const COLUMNS =
  "id, action, actor_id, actor_label, changes, occurred_at, table_name, record_id, business_line_id, origin";

export type RecentOptions = {
  limit?: number;
  /** `null` o ausente = todas las líneas. */
  businessLineId?: string | null;
};

/**
 * Lectura de `activity_log`. Ninguna consulta a Supabase vive fuera de aquí,
 * y todas filtran por `organization_id` explícitamente aunque RLS ya lo haga
 * (convención nº 2).
 *
 * Sin ninguna comprobación de rol: la tabla solo es legible por la persona
 * dueña (`is_owner`), así que al ayudante esto le devuelve una lista vacía
 * sin una línea de permisos aquí. Es la misma razón por la que el historial
 * del pedido tampoco comprueba nada.
 *
 * Un solo historial (convención nº 7): esta es la lectura de toda la
 * organización —la que usan el panel y, cuando llegue, V23— mientras que el
 * historial de una pantalla de detalle lee la misma tabla acotada a su
 * registro.
 */
export class ActivityService {
  constructor(private readonly supabase: SupabaseClient) {}

  async recent(
    organizationId: string,
    options: RecentOptions = {},
  ): Promise<RecentActivityEntry[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    let query = this.supabase
      .from("activity_log")
      .select(
        "id, action, actor_id, actor_label, changes, occurred_at, table_name, record_id, business_line_id",
      )
      .eq("organization_id", organizationId);

    // El filtro de línea va a la consulta y no al resultado: recortar después
    // de leer devolvería menos de `limit` filas cuando la línea activa no es
    // la de los últimos eventos, y la lista aparecería medio vacía sin que
    // faltara nada.
    if (options.businessLineId) {
      query = query.eq("business_line_id", options.businessLineId);
    }

    const { data, error } = await query
      .order("occurred_at", { ascending: false })
      // Dos eventos del mismo instante comparten `occurred_at`: sin el
      // desempate por el identificador —que es una identidad creciente— su
      // orden sería indeterminado y la lista bailaría entre recargas.
      .order("id", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`No se pudo cargar la bitácora: ${error.message}`);
    }

    return toEntries(data);
  }

  /**
   * Una página de la bitácora filtrada (V23).
   *
   * Con el cliente del usuario y sin `security definer`: RLS ya dice que solo
   * el dueño lee `activity_log`, y reescribir esa regla dentro de una función
   * privilegiada sería tener dos sitios donde puede divergir (design D1). Al
   * ayudante esto le devuelve una lista vacía sin una línea de permisos aquí.
   *
   * El orden es `occurred_at desc, id desc` —total y estable, porque `id` es
   * identidad creciente— y la página siguiente se pide por cursor y nunca por
   * desplazamiento: sobre cien mil eventos, `range()` obligaría al motor a
   * recorrer y descartar todo lo anterior, y un evento insertado entre dos
   * páginas movería el corte y repetiría o perdería una fila (design D2).
   */
  async search(
    organizationId: string,
    filters: ActivityFilters,
    options: {
      timezone: string;
      limit?: number;
      /**
       * El registro al que acotar, ya resuelto.
       *
       * `filters.search` es lo que la persona escribió —«142», o un `uuid`
       * pegado—; traducirlo a un `record_id` es una consulta y por eso ocurre
       * antes de llegar aquí. Así `ActivityFilters` sigue siendo lo que dice
       * la dirección y nada más.
       */
      recordId?: string | null;
    } = { timezone: "UTC" },
  ): Promise<ActivityPage> {
    const limit = Math.min(options.limit ?? PAGE_SIZE, PAGE_SIZE);

    let query = this.supabase
      .from("activity_log")
      .select(COLUMNS)
      .eq("organization_id", organizationId);

    const { fromInstant, toInstant } = rangeInstants(filters, options.timezone);
    if (fromInstant) query = query.gte("occurred_at", fromInstant);
    // Exclusivo: `to` apunta al principio del día siguiente, para que quien
    // filtra "hasta el 19" se lleve el evento de las 23:50.
    if (toInstant) query = query.lt("occurred_at", toInstant);

    if (filters.line !== ALL_LINES) {
      query = query.eq("business_line_id", filters.line);
    }
    if (filters.actor !== ANY) query = query.eq("actor_id", filters.actor);
    if (filters.table !== ANY) query = query.eq("table_name", filters.table);
    if (filters.action !== ANY) query = query.eq("action", filters.action);
    if (options.recordId) query = query.eq("record_id", options.recordId);

    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      // "Estrictamente después en el orden de la lista": o el instante es
      // anterior, o es el mismo y el identificador es menor.
      query = query.or(
        `occurred_at.lt.${cursor.occurredAt},and(occurred_at.eq.${cursor.occurredAt},id.lt.${cursor.id})`,
      );
    }

    // Se pide una fila de más para saber si hay página siguiente sin contar
    // el total, que es lo que este servicio no hace nunca.
    const { data, error } = await query
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (error) {
      throw new Error(`No se pudo cargar la bitácora: ${error.message}`);
    }

    const rows = toEntries(data);
    const entries = rows.slice(0, limit);

    return {
      entries,
      nextCursor:
        rows.length > limit && entries.length > 0
          ? encodeCursor(entries[entries.length - 1])
          : null,
    };
  }

  /**
   * El historial de un registro: lo que muestran los cinco bloques de detalle.
   *
   * Lee **la misma tabla con las mismas reglas** que la bitácora general
   * (convención nº 7). Que los eventos coincidan uno a uno con `/activity`
   * filtrada por ese registro no es una coincidencia que haya que mantener a
   * mano: es que no hay una segunda consulta con una segunda regla.
   */
  async forRecord(
    organizationId: string,
    tableName: string,
    recordId: string,
    limit = DEFAULT_LIMIT,
  ): Promise<RecentActivityEntry[]> {
    const { data, error } = await this.supabase
      .from("activity_log")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("table_name", tableName)
      .eq("record_id", recordId)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.min(limit, MAX_LIMIT));

    if (error) {
      throw new Error(`No se pudo cargar el historial: ${error.message}`);
    }

    return toEntries(data);
  }
}

/**
 * Una fila de `activity_log` como la lee la aplicación. Una sola conversión
 * para las tres consultas: `recent`, `search` y `forRecord`.
 */
function toEntries(data: unknown): RecentActivityEntry[] {
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as number,
    action: row.action as ActivityEntry["action"],
    actorId: (row.actor_id as string | null) ?? null,
    actorLabel: (row.actor_label as string | null) ?? null,
    changes: (row.changes as Record<string, unknown> | null) ?? null,
    occurredAt: row.occurred_at as string,
    tableName: row.table_name as string,
    recordId: row.record_id as string,
    businessLineId: (row.business_line_id as string | null) ?? null,
    origin: (row.origin as string | null) ?? null,
  }));
}

/**
 * El cursor es el par que ordena la lista: el instante y el identificador.
 *
 * Se codifica como texto porque viaja en la dirección —«Cargar más» es
 * navegación, no estado de cliente que se pierda al recargar—.
 */
export function encodeCursor(entry: {
  occurredAt: string;
  id: number;
}): string {
  return `${entry.occurredAt}|${entry.id}`;
}

export function decodeCursor(
  cursor: string | null,
): { occurredAt: string; id: number } | null {
  if (!cursor) return null;

  const separator = cursor.lastIndexOf("|");
  if (separator <= 0) return null;

  const occurredAt = cursor.slice(0, separator);
  const id = Number(cursor.slice(separator + 1));

  // Un cursor manipulado a mano no es un error que mostrar: es una dirección
  // que pide una página que no existe, y lo correcto es dar la primera.
  if (!Number.isSafeInteger(id) || Number.isNaN(Date.parse(occurredAt))) {
    return null;
  }
  return { occurredAt, id };
}
