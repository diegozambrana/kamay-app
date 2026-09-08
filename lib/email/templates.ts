import { destinationOf } from "@/lib/notifications/destination";
import type { PlannedNotification } from "@/lib/notifications/types";
import { travelsByEmail } from "@/lib/notifications/types";

import type { EmailMessage } from "./port";

/**
 * Los tres correos de KAM-17.
 *
 * Sin diseño de marca a propósito: **el correo es un enlace con contexto**, no
 * una pieza de comunicación. Lo que tiene que funcionar es que abra la tarea
 * correcta, incluso para quien lo lee en un cliente que no pinta HTML — de ahí
 * que el texto plano sea obligatorio y el HTML opcional.
 */

/**
 * Convierte un aviso en un correo, o en `null` si ese tipo no viaja por correo.
 *
 * Devolver `null` en lugar de que quien llama sepa qué tipos son de correo es
 * deliberado: la lista vive en un sitio (`EMAIL_TYPES`) y aquí solo se
 * consulta. Añadir un tipo al correo no debe exigir tocar el manejador de ruta.
 */
export function emailFor(
  // `entityType` se acepta como `string` y no como la unión estrecha de
  // `PlannedNotification`: una notificación **ya escrita** llega de la base con
  // lo que hubiera en la columna, y `destinationOf` ya sabe declarar
  // `unavailable` ante un tipo que no reconoce. Estrecharlo aquí obligaría a
  // afirmar en el borde algo que la base no garantiza.
  notification: Pick<PlannedNotification, "type" | "title" | "body"> & {
    entityType: string | null;
    entityId: string | null;
  },
  recipient: { email: string },
  appUrl: string,
): EmailMessage | null {
  if (!travelsByEmail(notification.type)) return null;

  const destination = destinationOf(notification);
  // Un aviso sin destino resoluble no se envía: un correo cuyo enlace no lleva
  // a ninguna parte es peor que no mandarlo.
  if (destination.kind !== "path") return null;

  const link = `${trimSlash(appUrl)}${destination.path}`;
  const body = notification.body ? `${notification.body}\n\n` : "";

  return {
    to: recipient.email,
    subject: notification.title,
    text: `${notification.title}\n\n${body}Ábrela en Kamay: ${link}\n`,
    html: html(notification.title, notification.body, link),
  };
}

function html(title: string, body: string | null, link: string): string {
  const paragraph = body ? `<p>${escape(body)}</p>` : "";

  return [
    `<h2>${escape(title)}</h2>`,
    paragraph,
    `<p><a href="${escape(link)}">Abrir en Kamay</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * El título y el cuerpo de un aviso llevan el título de una tarea, que lo
 * escribió una persona. Se escapa antes de meterlo en el HTML por el mismo
 * motivo por el que `lib/markdown/sanitize.ts` existe: lo que escribe alguien
 * no se interpreta.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function trimSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
