import type { SupabaseClient } from "@supabase/supabase-js";

import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import type {
  NotificationType,
  PlannedNotification,
} from "@/lib/notifications/types";
import type { Notification, NotificationGroup } from "@/types";

const COLUMNS =
  "id, organization_id, user_id, type, title, body, entity_type, entity_id, read_at, created_at";

type NotificationRow = {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/**
 * Acceso a `notifications`.
 *
 * La organización se filtra explícitamente en cada consulta aunque la RLS ya
 * lo haga (convención nº 2); lo que la RLS añade aquí, y no puede añadir el
 * código, es el `user_id = auth.uid()` que impide que un compañero de la misma
 * organización vea lo que no es suyo.
 */
export class NotificationService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * La bandeja: lo de esta persona, lo más reciente primero.
   *
   * **No agrupa nada por sí misma**: la agrupación anti-ruido ya la hizo el
   * generador (design D10). Lo que hace `groupByType()` sobre este resultado
   * es puramente visual.
   */
  async list(organizationId: string, limit = 50): Promise<Notification[]> {
    const { data, error } = await this.supabase
      .from("notifications")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .overrideTypes<NotificationRow[]>();

    if (error) {
      throw new Error(`No se pudieron cargar los avisos: ${error.message}`);
    }

    return (data ?? []).map(toNotification);
  }

  /** El número de la campana. Cero no se muestra: se omite el contador. */
  async unreadCount(organizationId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("read_at", null);

    if (error) {
      throw new Error(`No se pudo contar los avisos: ${error.message}`);
    }

    return count ?? 0;
  }

  /**
   * Marcar leída. La RLS decide si la fila se alcanza; si es de otra persona,
   * la operación no afecta a ninguna fila y no es un error — no hay nada que
   * contarle a quien lo intentó.
   */
  async markRead(organizationId: string, id: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", id);

    if (error) {
      throw new Error(`No se pudo marcar el aviso: ${error.message}`);
    }
  }

  async markAllRead(organizationId: string): Promise<void> {
    const { error } = await this.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .is("read_at", null);

    if (error) {
      throw new Error(`No se pudieron marcar los avisos: ${error.message}`);
    }
  }

  /**
   * Escribe los avisos que `plan()` decidió.
   *
   * **Solo el generador llama a esto, y solo con el cliente privilegiado**
   * (design D5). El `on conflict do nothing` sobre `dedupe_key` es lo que hace
   * reejecutable el trabajo programado: dos pasadas simultáneas no duplican
   * nada, sin necesidad de leer antes de escribir.
   *
   * @returns las notificaciones que **realmente** se crearon; las que ya
   *   existían no vuelven. Es lo que permite enviar un correo por aviso nuevo
   *   y no uno por pasada.
   */
  async createMany(
    planned: PlannedNotification[],
  ): Promise<Notification[]> {
    if (planned.length === 0) return [];

    const { data, error } = await this.supabase
      .from("notifications")
      // `upsert` con `ignoreDuplicates` es cómo supabase-js escribe
      // `insert ... on conflict do nothing`: **no actualiza nada**, y por eso
      // le basta el privilegio de `insert` que la migración concede al
      // service role. `insert` a secas no acepta `onConflict`.
      .upsert(
        planned.map((notification) => ({
          organization_id: notification.organizationId,
          user_id: notification.userId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          entity_type: notification.entityType,
          entity_id: notification.entityId,
          dedupe_key: notification.dedupeKey,
        })),
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      )
      .select(COLUMNS)
      .overrideTypes<NotificationRow[]>();

    if (error) {
      throw new Error(`No se pudieron crear los avisos: ${error.message}`);
    }

    return (data ?? []).map(toNotification);
  }
}

/**
 * Agrupa por tipo conservando el orden cronológico dentro de cada grupo.
 *
 * Los grupos salen en el orden del catálogo y **solo aparecen los que tienen
 * contenido**: un encabezado de tipo vacío sería una sección en blanco, que es
 * justo lo que el panel del ayudante enseñó a no hacer.
 */
export function groupByType(
  notifications: Notification[],
): NotificationGroup[] {
  return NOTIFICATION_TYPES.map((type) => ({
    type,
    notifications: notifications.filter(
      (notification) => notification.type === type,
    ),
  })).filter((group) => group.notifications.length > 0);
}
