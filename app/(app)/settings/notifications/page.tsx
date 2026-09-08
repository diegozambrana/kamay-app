import { redirect } from "next/navigation";

import { NotificationsSection } from "@/features/settings/notifications-section";
import { getSessionContext } from "@/lib/auth/session-context";
import { PreferenceService } from "@/services/notifications/preference-service";

export const metadata = { title: "Notificaciones · Configuración · Kamay" };

/**
 * La **única** sección de V15 que no exige ser dueño (design D1).
 *
 * Las otras siete configuran el taller —líneas, canales, estados, personas— y
 * son suyas. Estas son preferencias de quien las mira, y el mapa manda
 * *V21 → Preferencias → V15 → Notificaciones* para los dos roles: un ayudante
 * que no puede silenciar sus propios avisos acaba silenciándolos todos.
 *
 * No recibe ningún identificador de usuario ni lo acepta: lee y escribe
 * siempre las de la sesión, y la RLS (`user_id = auth.uid()`) lo respalda.
 */
export default async function NotificationSettingsPage() {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const preferences = await new PreferenceService(context.supabase).forUser(
    context.organizationId,
    context.userId,
  );

  return (
    <section>
      <h2 className="text-lg font-medium">Notificaciones</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Qué avisos quieres recibir y cuándo. Son tuyos: cada persona del taller
        tiene los suyos.
      </p>
      <NotificationsSection initial={preferences} />
    </section>
  );
}
