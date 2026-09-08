import "server-only";

import { resolveMailer } from "@/lib/email/resolve";
import { planAssignment, planStatusChange } from "@/lib/notifications/plan";
import type { PlannedNotification } from "@/lib/notifications/types";
import { createAdminClient } from "@/lib/supabase/admin";

import { NotificationGenerator } from "./generator";
import { PreferenceService } from "./preference-service";

/**
 * Los avisos que nacen de un acto concreto, emitidos desde la Server Action
 * que lo provocó.
 *
 * **El reparto de clientes es la parte que importa** (design D5): la acción ya
 * escribió la tarea con el cliente de la sesión, con la RLS intacta y
 * habiendo comprobado que quien actúa alcanza esa tarea. Solo la creación de
 * la notificación pasa por el cliente privilegiado, y únicamente para insertar
 * en `notifications` a nombre de un destinatario que aquella comprobación ya
 * validó. No es una puerta trasera para escribir datos del taller.
 *
 * Se separa de `actions/tasks.ts` para que la frontera sea visible: `actions/`
 * no importa `lib/supabase/admin.ts` en ninguna línea, y hay una prueba de
 * arquitectura que lo comprueba.
 *
 * **Nunca lanza.** Un fallo generando el aviso no puede deshacer la escritura
 * de la tarea, que ya ocurrió y es lo que la persona pidió.
 */
export async function emitTaskEvents(input: {
  organizationId: string;
  actorId: string;
  task: { id: string; title: string; assigneeId: string | null };
  /** Presente cuando el acto fue asignar. */
  assignedTo?: string | null;
  /** Presentes cuando el acto fue mover de estado. */
  status?: { id: string; kind: "initial" | "in_progress" | "waiting" | "final" | "cancelled" };
}): Promise<void> {
  try {
    // **Se planifica antes de tocar la base.** Con `preferences: null` las
    // funciones puras deciden solo por la forma del hecho, y devuelven vacío
    // en el caso corriente: mover una tarea entre dos columnas que no son de
    // revisión no genera nada. Sin esto, cada arrastre del tablero pagaba una
    // lectura de preferencias para tirarla a la basura, y esa latencia se
    // sumaba a una acción que la persona está esperando.
    const candidates: PlannedNotification[] = [];

    if (input.assignedTo !== undefined) {
      candidates.push(
        ...planAssignment({
          organizationId: input.organizationId,
          task: input.task,
          assigneeId: input.assignedTo,
          actorId: input.actorId,
          preferences: null,
        }),
      );
    }

    if (input.status) {
      candidates.push(
        ...planStatusChange({
          organizationId: input.organizationId,
          task: input.task,
          statusId: input.status.id,
          statusKind: input.status.kind,
          actorId: input.actorId,
          preferences: null,
        }),
      );
    }

    if (candidates.length === 0) return;

    // Solo a partir de aquí hay algo que decir, y solo aquí se consulta.
    const admin = createAdminClient();
    const preferences = new PreferenceService(admin);
    const resolved = await preferences.forOrganization(
      input.organizationId,
      candidates.map((notification) => notification.userId),
    );

    // El apagado por tipo se aplica ahora, con las preferencias reales: es la
    // misma decisión que las funciones puras habrían tomado, tomada más tarde.
    const planned = candidates.filter(
      (notification) => resolved.get(notification.userId)?.[notification.type],
    );
    if (planned.length === 0) return;

    const recipients = await emailsFor(
      admin,
      planned.map((notification) => notification.userId),
    );
    const emailEnabled = new Map(
      [...resolved].map(([userId, prefs]) => [userId, prefs.emailEnabled]),
    );

    await new NotificationGenerator(admin, resolveMailer()).emit(planned, {
      recipients,
      emailEnabled,
    });
  } catch (error) {
    // La tarea ya está guardada. Perder su aviso es molesto; deshacer lo que
    // la persona acaba de hacer, inaceptable.
    console.error("[notifications] no se pudo emitir el aviso de tarea:", error);
  }
}

/** El correo de cada destinatario, leído de `auth.users` con el privilegio. */
async function emailsFor(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();

  for (const userId of [...new Set(userIds)]) {
    const { data } = await admin.auth.admin.getUserById(userId);
    if (data?.user?.email) emails.set(userId, data.user.email);
  }

  return emails;
}
