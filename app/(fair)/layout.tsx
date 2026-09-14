import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BusinessLineProvider } from "@/components/providers/business-line-provider";
import { OrganizationProvider } from "@/components/providers/organization-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { lineCookieName } from "@/constants/auth";
import { SyncProvider } from "@/features/sync/sync-provider";
import { PLATFORM_HOME, SELECT_ORG_PATH } from "@/lib/auth/access";
import {
  getRequestAccess,
  getRequestMemberships,
  getRequestUser,
} from "@/lib/auth/request-user";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { createClient } from "@/lib/supabase/server";
import { BusinessLineService } from "@/services/configuration/business-line-service";

/**
 * El modo feria (V6, KAM-12): la única parte de Kamay que rompe el cascarón.
 *
 * **Sin cabecera, sin barra inferior, sin menú lateral y sin botón flotante.**
 * No ocultos: **no montados**. El criterio 1 dice que no existe ningún
 * elemento de navegación tocable salvo la salida explícita, y una barra
 * escondida con CSS existe: reaparece con un cambio de estilo, con un foco de
 * teclado, con un `prefers-reduced-motion`. Un layout que no la monta no puede
 * fallar así (design.md, decisión 7).
 *
 * Cada elemento de navegación visible en un puesto de feria es un toque
 * accidental esperando ocurrir, y un toque accidental es una venta perdida.
 *
 * Lo que sí se conserva es la sesión: usuario, organización y línea hacen
 * falta para escribir, y `SyncProvider` no aporta nada visible. La
 * organización y el rol se resuelven con la misma regla que el cascarón
 * (`resolveAccess`, KAM-26): un super admin vende en la organización en
 * la que entró, como su dueño.
 */
export default async function FairLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getRequestUser();
  if (!user) redirect("/auth/login");

  const resolution = await getRequestAccess();
  if (!resolution || resolution.kind === "no-organization") redirect("/auth/login");
  // Sin organización resuelta no se entra a la feria: elegirla es una decisión
  // de antes de abrir el puesto, no de mitad de una venta.
  if (resolution.kind === "choose-organization") redirect(SELECT_ORG_PATH);
  if (resolution.kind === "platform") redirect(PLATFORM_HOME);

  const { access } = resolution;
  const supabase = await createClient();
  const [memberships, lines, cookieStore] = await Promise.all([
    getRequestMemberships(user.id),
    new BusinessLineService(supabase).listActive(access.organizationId),
    cookies(),
  ]);
  const activeLine = resolveActiveLine(
    cookieStore.get(lineCookieName(access.organizationId))?.value,
    lines,
  );

  return (
    <UserProvider
      user={{ id: user.id, email: user.email ?? "" }}
      membership={
        access.membership
          ? {
              id: access.membership.id,
              organizationId: access.membership.organizationId,
              role: access.membership.role,
              displayName: access.membership.displayName,
            }
          : null
      }
      role={access.role}
      platformAdmin={access.platformAdmin}
    >
      <OrganizationProvider
        organization={access.organization}
        memberships={memberships}
      >
        <BusinessLineProvider lines={lines} activeLine={activeLine}>
          {/* Sin interfaz propia: registra las operaciones de la cola, la
              refleja en el store y dispara el vaciado al reconectar y cada
              30 s. Es lo que hace que las ventas salgan solas en cuanto haya
              un hueco de señal (design.md, decisión 5). */}
          <SyncProvider />
          {/* `h-dvh` y no `min-h`: la cuadrícula ocupa el alto disponible y la
              barra de cobro queda fija abajo sin depender del scroll de la
              página. Nada de esto debe desplazarse en horizontal. */}
          <div className="flex h-dvh flex-col overflow-hidden bg-background">
            {children}
          </div>
        </BusinessLineProvider>
      </OrganizationProvider>
    </UserProvider>
  );
}
