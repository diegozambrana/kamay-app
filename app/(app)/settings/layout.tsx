import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { SettingsNav } from "@/features/settings/settings-nav";
import { getSessionContext } from "@/lib/auth/session-context";

export const metadata = { title: "Configuración · Kamay" };

/**
 * V15 · Configuración: página completa.
 *
 * **La guardia de rol vive en cada sección, no aquí** (design D6). Hasta
 * KAM-17 el layout entero exigía ser dueño, y bastaba porque las siete
 * secciones lo eran; con las preferencias de notificación —que son de la
 * persona y no del taller— deja de bastar. Las siete siguen llamando a
 * `getOwnerContext()` por su cuenta, como ya hacían: bajar la guardia no
 * relajó ninguna, solo dejó de aplicarla dos veces.
 *
 * La seguridad real sigue siendo la RLS —`is_owner` en cada tabla de
 * configuración, y `user_id = auth.uid()` en `notification_preferences`—. Esto
 * es interfaz.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getSessionContext();
  if (!context) redirect("/auth/login");

  const isOwner = context.membership.role === "owner";

  return (
    <MainContainer
      title="Configuración"
      description={context.membership.organization.name}
    >
      {/* Las secciones son pestañas aquí y no entradas del menú lateral: en
          el menú serían un segundo juego de enlaces con los mismos nombres. */}
      <div className="mx-auto w-full max-w-4xl">
        <SettingsNav isOwner={isOwner} />
        <div className="mt-6">{children}</div>
      </div>
    </MainContainer>
  );
}
