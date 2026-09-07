import type { SupabaseClient } from "@supabase/supabase-js";

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
};

/**
 * El tope de filas lo impone el servicio, no quien llama. Una lista de "qué
 * pasó" sin techo es una consulta de decenas de miles de filas esperando a
 * que la bitácora crezca —y va a crecer: es el grupo de datos de mayor
 * volumen del sistema (§9)—.
 */
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 5;

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
    }));
  }
}
