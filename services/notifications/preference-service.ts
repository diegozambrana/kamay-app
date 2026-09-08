import type { SupabaseClient } from "@supabase/supabase-js";

import { resolvePreferences } from "@/lib/notifications/defaults";
import type { PreferencesRow } from "@/lib/notifications/defaults";
import type { NotificationPreferences } from "@/lib/notifications/types";

const COLUMNS =
  "user_id, due_summary, task_assigned, task_review, task_overdue, task_stalled, stock_below_min, daily_summary_hour, email_enabled";

type Row = PreferencesRow & { user_id: string };

/**
 * Acceso a `notification_preferences`.
 *
 * **La ausencia de fila es el caso normal, no un error.** Nadie siembra estas
 * filas al invitar a alguien: quien nunca abrió la sección recibe los valores
 * por omisión, y guardar por primera vez crea la fila con un `upsert`.
 */
export class PreferenceService {
  constructor(private readonly supabase: SupabaseClient) {}

  /** Las de quien pregunta, ya resueltas contra los valores por omisión. */
  async forUser(
    organizationId: string,
    userId: string,
  ): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
      .from("notification_preferences")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle()
      .overrideTypes<Row>();

    if (error) {
      throw new Error(
        `No se pudieron cargar las preferencias: ${error.message}`,
      );
    }

    return resolvePreferences(data);
  }

  /**
   * Las de toda la organización, para el trabajo programado.
   *
   * Devuelve un mapa por usuario **incluyendo a quien no tiene fila**, porque
   * esa persona también recibe avisos: pedir la lista de miembros aparte y
   * cruzarla aquí es lo que evita que alguien se quede sin resumen por no
   * haber entrado nunca en la sección.
   */
  async forOrganization(
    organizationId: string,
    userIds: string[],
  ): Promise<Map<string, NotificationPreferences>> {
    const { data, error } = await this.supabase
      .from("notification_preferences")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .overrideTypes<Row[]>();

    if (error) {
      throw new Error(
        `No se pudieron cargar las preferencias: ${error.message}`,
      );
    }

    const stored = new Map((data ?? []).map((row) => [row.user_id, row]));

    return new Map(
      userIds.map((userId) => [
        userId,
        resolvePreferences(stored.get(userId) ?? null),
      ]),
    );
  }

  /**
   * Guarda las de quien las edita.
   *
   * `updated_at` va en el `upsert` porque el esquema no tiene función de sello
   * y esta tabla no iba a estrenar una para sí sola.
   */
  async save(
    organizationId: string,
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<void> {
    const { error } = await this.supabase
      .from("notification_preferences")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          due_summary: preferences.due_summary,
          task_assigned: preferences.task_assigned,
          task_review: preferences.task_review,
          task_overdue: preferences.task_overdue,
          task_stalled: preferences.task_stalled,
          stock_below_min: preferences.stock_below_min,
          daily_summary_hour: preferences.dailySummaryHour,
          email_enabled: preferences.emailEnabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" },
      );

    if (error) {
      throw new Error(
        `No se pudieron guardar las preferencias: ${error.message}`,
      );
    }
  }
}
