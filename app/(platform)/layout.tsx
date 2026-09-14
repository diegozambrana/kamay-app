import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  getRequestAccess,
  getRequestMemberships,
  getRequestPlatformAdmin,
  getRequestUser,
} from "@/lib/auth/request-user";
import { defaultLandingPath } from "@/lib/auth/routes";

/**
 * Las vistas de la plataforma —*Organizaciones* y *Usuarios*— (KAM-26,
 * design D7). Reservadas al administrador de la plataforma: cualquier otra
 * cuenta vuelve a su inicio, igual que el ayudante que abre Configuración.
 *
 * No dependen de una organización activa. Si el super admin está dentro de
 * una, el cascarón es el completo, como en cualquier otra pantalla; si no, el
 * reducido. Por eso viven fuera de `(app)`: aquel layout manda a este grupo
 * al super admin sin organización, y un layout no sabe qué ruta envuelve.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getRequestUser();
  if (!user) redirect("/auth/login");

  if (!(await getRequestPlatformAdmin())) {
    redirect(defaultLandingPath((await headers()).get("user-agent")));
  }

  const [resolution, memberships] = await Promise.all([
    getRequestAccess(),
    getRequestMemberships(user.id),
  ]);

  return (
    <AppShell
      user={{ id: user.id, email: user.email ?? "" }}
      access={resolution?.kind === "active" ? resolution.access : null}
      platformAdmin
      memberships={memberships}
    >
      {children}
    </AppShell>
  );
}
