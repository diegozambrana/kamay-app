import "server-only";

import type { Mailer } from "./port";

/**
 * Elige el transporte de correo según lo que haya configurado.
 *
 * **Devuelve `null` mientras no haya proveedor provisionado**, y esa es la
 * conducta correcta y no un apaño: el aviso dentro de la aplicación es la
 * garantía y el correo el refuerzo (design D7), así que un despliegue sin
 * Resend genera todas sus notificaciones y no envía ningún correo, en lugar de
 * fallar o de fingir que lo mandó.
 *
 * El adaptador de Resend se enchufa aquí en cuanto la integración esté
 * provisionada; ningún otro archivo tendrá que cambiar.
 */
export function resolveMailer(): Mailer | null {
  if (!process.env.RESEND_API_KEY) return null;

  // Pendiente: `new ResendMailer(process.env.RESEND_API_KEY)`, una vez que
  // `vercel integration add resend/resend-email` haya provisionado la clave y
  // el SDK esté instalado (tarea 1.2 / 4.2 de este cambio).
  return null;
}
