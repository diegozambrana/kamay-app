import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { NoOrganizationNotice } from "@/features/account/no-organization-notice";
import { SELECT_ORG_PATH } from "@/lib/auth/access";
import {
  getRequestAccess,
  getRequestMemberships,
  getRequestUser,
} from "@/lib/auth/request-user";

/**
 * Las pantallas de la propia cuenta —hoy, el perfil— (KAM-26, design D7).
 *
 * Son de la persona, no de una organización: el administrador de la
 * plataforma tiene que poder abrir su perfil también sin organización activa
 * (spec `platform-administration` → *A platform admin's profile reflects
 * platform access*). Bajo `(app)` eso no era posible, porque aquel layout lo
 * mandaría a *Organizaciones*. Para el resto de cuentas se comporta igual que
 * `(app)`: aviso sin organización, selección con varias.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getRequestUser();
  if (!user) redirect("/auth/login");

  const resolution = await getRequestAccess();
  if (!resolution) redirect("/auth/login");
  if (resolution.kind === "no-organization") return <NoOrganizationNotice />;
  if (resolution.kind === "choose-organization") redirect(SELECT_ORG_PATH);

  const memberships = await getRequestMemberships(user.id);
  const access = resolution.kind === "active" ? resolution.access : null;

  return (
    <AppShell
      user={{ id: user.id, email: user.email ?? "" }}
      access={access}
      platformAdmin={resolution.kind === "platform" || Boolean(access?.platformAdmin)}
      memberships={memberships}
    >
      {children}
    </AppShell>
  );
}
