import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Mailer } from "@/lib/email/port";
import { emailFor } from "@/lib/email/templates";
import type { PlannedNotification } from "@/lib/notifications/types";
import type { Notification } from "@/types";

import { NotificationService } from "./notification-service";

/**
 * El **único** punto del sistema que escribe notificaciones, y por tanto el
 * único que recibe el cliente privilegiado (design D5).
 *
 * La tensión con la convención nº 2 es real y se resuelve así: una acción
 * disparada por una persona escribe su tarea con el cliente de sesión —RLS
 * intacta— y solo la creación del aviso pasa por aquí, con la organización y
 * el destinatario ya resueltos por quien llama. El privilegio se limita a
 * insertar en `notifications` para alguien que la RLS de la tarea ya validó;
 * no es una puerta trasera para escribir datos del taller.
 *
 * Ninguna otra rebanada importa `lib/supabase/admin.ts`, y hay una prueba de
 * arquitectura que lo comprueba.
 */
export class NotificationGenerator {
  private readonly notifications: NotificationService;

  constructor(
    /** Cliente con service role. No se acepta ningún otro. */
    admin: SupabaseClient,
    private readonly mailer: Mailer | null = null,
    private readonly appUrl = process.env.APP_URL ?? "",
  ) {
    this.notifications = new NotificationService(admin);
  }

  /**
   * Escribe los avisos decididos y envía los correos que correspondan.
   *
   * **El orden importa y es la garantía de un criterio de aceptación:** la
   * notificación existe antes de que se intente el correo, y un fallo del
   * envío se registra y no interrumpe nada. La bandeja es la garantía; el
   * correo, el refuerzo.
   *
   * Solo se envía correo por los avisos **realmente creados** —los que el
   * `on conflict do nothing` dejó pasar—, nunca por los que ya existían: es lo
   * que impide que una reejecución del trabajo reenvíe correos.
   *
   * @param recipients correo de cada destinatario, por `user_id`. Quien no
   *   esté aquí recibe su aviso en la bandeja y ningún correo.
   * @param emailEnabled quién quiere correo, por `user_id`. Apagarlo deja el
   *   aviso dentro de la aplicación intacto.
   */
  async emit(
    planned: PlannedNotification[],
    options: {
      recipients?: Map<string, string>;
      emailEnabled?: Map<string, boolean>;
    } = {},
  ): Promise<Notification[]> {
    const created = await this.notifications.createMany(planned);

    if (this.mailer && created.length > 0) {
      await this.sendEmails(created, options);
    }

    return created;
  }

  private async sendEmails(
    created: Notification[],
    options: {
      recipients?: Map<string, string>;
      emailEnabled?: Map<string, boolean>;
    },
  ): Promise<void> {
    const { recipients, emailEnabled } = options;
    if (!recipients || !this.appUrl) return;

    for (const notification of created) {
      if (emailEnabled?.get(notification.userId) === false) continue;

      const email = recipients.get(notification.userId);
      if (!email) continue;

      const message = emailFor(notification, { email }, this.appUrl);
      if (!message) continue;

      try {
        await this.mailer!.send(message);
      } catch (error) {
        // Un proveedor caído no puede llevarse por delante el aviso, que ya
        // está escrito, ni detener el envío a los demás destinatarios.
        console.error(
          `[notifications] no se pudo enviar el correo de ${notification.id}:`,
          error,
        );
      }
    }
  }
}
