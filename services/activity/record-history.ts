import type { SupabaseClient } from "@supabase/supabase-js";

import { describeEvent } from "@/lib/activity/describe";
import { type EventDetail, buildDetail } from "@/lib/activity/diff";
import { recordActivityHref } from "@/lib/activity/filters";

import { ActivityService } from "./activity-service";
import { LabelService } from "./label-service";

/** Un evento del historial de un registro, ya redactado y resuelto. */
export type RecordHistoryItem = {
  id: number;
  action: string;
  /** La frase de `describeEvent()`: la misma que la bitácora general. */
  sentence: string;
  occurredAt: string;
  detail: EventDetail;
};

export type RecordHistory = {
  items: RecordHistoryItem[];
  /** La bitácora general ya filtrada por este registro. */
  activityHref: string;
};

/**
 * El historial de un registro, listo para pintar.
 *
 * Existe para que las cinco pantallas de detalle —pedido, ítem, egreso, tarea
 * y activo— no tengan que repetir cada una la misma composición de lectura,
 * resolución y redacción. Antes de KAM-22 cada una tenía su propio
 * `ACTION_LABELS` y ninguna usaba `describeEvent()`: el mismo evento se leía
 * de cinco maneras distintas según la pantalla.
 *
 * Lee de `activity_log` y **de ninguna otra fuente** (convención nº 7). Que lo
 * que devuelve coincida con `/activity` filtrada por ese registro no es una
 * coincidencia que mantener a mano: es la misma consulta con el mismo filtro.
 *
 * Para quien no puede leer la bitácora devuelve una lista vacía, no un error:
 * la RLS le da cero filas y eso no es un fallo, es su permiso.
 */
export async function loadRecordHistory(
  supabase: SupabaseClient,
  options: {
    organizationId: string;
    tableName: string;
    recordId: string;
    timezone: string;
    currency: string;
    limit?: number;
  },
): Promise<RecordHistory> {
  const { organizationId, tableName, recordId } = options;

  const entries = await new ActivityService(supabase).forRecord(
    organizationId,
    tableName,
    recordId,
    options.limit,
  );

  const activityHref = recordActivityHref(tableName, recordId);
  if (entries.length === 0) return { items: [], activityHref };

  const labels = new LabelService(supabase);
  const [names, actorNames] = await Promise.all([
    labels.forDetails(organizationId, entries),
    labels.people(
      organizationId,
      entries.map((entry) => entry.actorId).filter((id) => id !== null),
    ),
  ]);

  return {
    activityHref,
    items: entries.map((entry) => {
      const actorName = entry.actorId
        ? (actorNames.get(entry.actorId) ?? null)
        : null;

      return {
        id: entry.id,
        action: entry.action,
        // Sin `recordLabel`: quien mira ya está dentro del registro, y
        // repetir «el pedido #142» en cada línea de su propio historial
        // sería ruido.
        sentence: describeEvent({
          action: entry.action,
          tableName: entry.tableName,
          actorName,
          actorLabel: entry.actorLabel,
        }),
        occurredAt: entry.occurredAt,
        detail: buildDetail(entry.tableName, entry.changes, {
          timezone: options.timezone,
          currency: options.currency,
          names,
        }),
      };
    }),
  };
}
