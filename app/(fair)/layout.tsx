import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BusinessLineProvider } from "@/components/providers/business-line-provider";
import { OrganizationProvider } from "@/components/providers/organization-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { lineCookieName, ORG_COOKIE } from "@/constants/auth";
import { SyncProvider } from "@/features/sync/sync-provider";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { createClient } from "@/lib/supabase/server";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { MembershipService } from "@/services/membership-service";

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
 * falta para escribir, y `SyncProvider` no aporta nada visible.
 */
export default async function FairLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const memberships = await new MembershipService(supabase).listActiveForUser(
    user.id,
  );
  if (memberships.length === 0) redirect("/auth/login");

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.organizationId === cookieOrgId) ??
    (memberships.length === 1 ? memberships[0] : undefined);

  // Sin organización resuelta no se entra a la feria: elegirla es una decisión
  // de antes de abrir el puesto, no de mitad de una venta.
  if (!active) redirect("/auth/select-org");

  const lines = await new BusinessLineService(supabase).listActive(
    active.organizationId,
  );
  const activeLine = resolveActiveLine(
    cookieStore.get(lineCookieName(active.organizationId))?.value,
    lines,
  );

  return (
    <UserProvider
      user={{ id: user.id, email: user.email ?? "" }}
      membership={{
        id: active.id,
        organizationId: active.organizationId,
        role: active.role,
        displayName: active.displayName,
      }}
    >
      <OrganizationProvider
        organization={active.organization}
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
