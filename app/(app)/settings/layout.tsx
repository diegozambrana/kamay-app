import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { SettingsNav } from "@/features/settings/settings-nav";
import { getOwnerContext } from "@/lib/auth/session-context";
import { defaultLandingPath } from "@/lib/auth/routes";

export const metadata = { title: "Configuración · Kamay" };

/**
 * V15 · Configuración: página completa, solo dueño. Esta guardia es interfaz;
 * la seguridad real es la RLS (`is_owner` en cada tabla de configuración), que
 * dejaría a un ayudante sin poder escribir aunque llegara hasta aquí.
 */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getOwnerContext();

  if (!context) {
    // El ayudante que entra por dirección directa termina en su aterrizaje
    // habitual, no en una pantalla de "no autorizado".
    redirect(defaultLandingPath((await headers()).get("user-agent")));
  }

  return (
    <MainContainer
      title="Configuración"
      description={context.membership.organization.name}
    >
      {/* Las secciones son pestañas aquí y no entradas del menú lateral: en
          el menú serían un segundo juego de enlaces con los mismos nombres. */}
      <div className="mx-auto w-full max-w-4xl">
        <SettingsNav />
        <div className="mt-6">{children}</div>
      </div>
    </MainContainer>
  );
}
