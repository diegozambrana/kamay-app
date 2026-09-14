import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { NoOrganizationNotice } from "@/features/account/no-organization-notice";
import { PLATFORM_HOME, SELECT_ORG_PATH } from "@/lib/auth/access";
import {
  getRequestAccess,
  getRequestMemberships,
  getRequestUser,
} from "@/lib/auth/request-user";

/**
 * AuthCheck: resuelve con qué organización y rol se actúa (`resolveAccess`,
 * KAM-26) y envuelve la interfaz en el cascarón. El proxy ya bloquea sin
 * sesión; esto es la segunda línea de defensa.
 *
 * Todo lo que cuelga de `(app)` necesita una organización activa. Por eso el
 * administrador de la plataforma sin organización va a *Organizaciones*, que
 * vive en otro grupo de rutas —`(platform)`— justamente para que esta
 * redirección no se aplique a sí misma (design D7).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Una sola validación por petición, compartida con la página (KAM-23).
  const user = await getRequestUser();
  if (!user) redirect("/auth/login");

  const resolution = await getRequestAccess();

  switch (resolution?.kind) {
    case "active": {
      const memberships = await getRequestMemberships(user.id);
      return (
        <AppShell
          user={{ id: user.id, email: user.email ?? "" }}
          access={resolution.access}
          platformAdmin={resolution.access.platformAdmin}
          memberships={memberships}
        >
          {children}
        </AppShell>
      );
    }
    // Sin organización no hay cascarón ni menú de cuenta: el aviso trae su
    // propia salida (KAM-25). Nunca para un super admin: él cae en "platform".
    case "no-organization":
      return <NoOrganizationNotice />;
    // Cookie ausente o inválida con varias organizaciones: se vuelve a elegir
    // (la selección sobreescribe la cookie).
    case "choose-organization":
      redirect(SELECT_ORG_PATH);
    case "platform":
      redirect(PLATFORM_HOME);
    default:
      redirect("/auth/login");
  }
}
