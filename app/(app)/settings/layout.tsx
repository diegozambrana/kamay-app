import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {context.membership.organization.name}
      </p>

      <SettingsNav />

      <div className="mt-6">{children}</div>
    </div>
  );
}
