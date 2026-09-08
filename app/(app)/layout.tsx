import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { MobileContextBar } from "@/components/layout/mobile-context-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RegisterButton } from "@/features/quick-capture/register-button";
import { SyncProvider } from "@/features/sync/sync-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BusinessLineProvider } from "@/components/providers/business-line-provider";
import { OrganizationProvider } from "@/components/providers/organization-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { lineCookieName, ORG_COOKIE } from "@/constants/auth";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { createClient } from "@/lib/supabase/server";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import { MembershipService } from "@/services/membership-service";
import {
  NotificationService,
  groupByType,
} from "@/services/notifications/notification-service";

/**
 * AuthCheck: carga usuario y membresías, revalida la organización activa
 * (cookie `kamay-org`) y envuelve la interfaz en los providers.
 * El proxy ya bloquea sin sesión; esto es la segunda línea de defensa.
 */
export default async function AppLayout({
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

  if (memberships.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Tu cuenta no pertenece a ninguna organización. Pide a la persona
          dueña que te invite.
        </p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get(ORG_COOKIE)?.value;
  let active = memberships.find((m) => m.organizationId === cookieOrgId);

  if (!active) {
    if (memberships.length === 1) {
      // Cookie ausente o inválida con una sola organización: no hay ambigüedad.
      active = memberships[0];
    } else {
      // Cookie inválida con varias organizaciones: se vuelve a elegir
      // (la selección sobreescribe la cookie).
      redirect("/auth/select-org");
    }
  }

  // El contexto de línea se resuelve aquí, antes del primer render: ninguna
  // pantalla debe aparecer primero sin línea y cambiar después (D5).
  const lines = await new BusinessLineService(supabase).listActive(
    active.organizationId,
  );
  const activeLine = resolveActiveLine(
    cookieStore.get(lineCookieName(active.organizationId))?.value,
    lines,
  );

  // La bandeja y el contador se componen aquí, en el cascarón, porque la
  // campana es un elemento siempre disponible (mapa §4.1): cargarlos en cada
  // página los duplicaría, y cargarlos en el cliente haría parpadear el
  // contador en cada navegación.
  const notificationService = new NotificationService(supabase);
  const notifications = await notificationService.list(active.organizationId);
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Ausente = desplegado, que es el valor por defecto de shadcn.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

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
          {/* `SidebarProvider` es el shell: dispone menú y contenido en fila
              y guarda el plegado en cookie. Cada página rinde su propio
              `MainContainer`, que es quien pone el encabezado y el padding. */}
          {/* Los rótulos del menú plegado son tooltips de Radix, y esta
              versión de `SidebarProvider` no trae su proveedor incorporado. */}
          <TooltipProvider delayDuration={0}>
            {/* El plegado lo escribe el cliente en `sidebar_state`, pero
                quien decide el primer render es el servidor: sin esto el menú
                aparecería desplegado y se plegaría de golpe tras hidratar. */}
            <SidebarProvider defaultOpen={sidebarOpen}>
              {/* Refleja la cola en el store y dispara el vaciado. Va dentro
                  de los providers de sesión: sin organización y persona no
                  puede decidir qué entrada sale. */}
              <SyncProvider />
              <AppSidebar />
              {/* `min-w-0`: sin él, un contenido interno más ancho que la
                  ventana (el tablero, por ejemplo) empuja este contenedor —
                  que es un ítem flex— más allá del viewport en vez de dejar
                  que su propio `overflow-x-auto` lo absorba. El síntoma es
                  que la barra superior, al ser hermana en el mismo desborde,
                  se mueve con el scroll horizontal en vez de quedarse fija.

                  `overflow-x-clip`: `min-w-0` no bastaba. En 390 px el
                  desbordamiento del tablero seguía llegando al documento, y
                  con él crecía el bloque contenedor de los elementos
                  `fixed` —la barra inferior y el botón flotante—, que
                  aparecían a 567 px de ancho en una pantalla de 390. El
                  recorte va aquí y no en `MainContainer` porque esos dos son
                  hermanos suyos, no descendientes. `clip` y no `hidden`:
                  `hidden` crearía un contexto de desplazamiento y rompería
                  los encabezados `sticky`. */}
              <SidebarInset className="min-w-0 overflow-x-clip">
                <Header
                  unreadCount={unreadCount}
                  notificationGroups={groupByType(notifications)}
                  timezone={active.organization.timezone}
                />
                <MobileContextBar />
                {children}
                {/* Registrar está a un toque desde cualquier pantalla (mapa
                    §2.6). Flota sobre la barra, no dentro de ella. */}
                <RegisterButton />
                <MobileNav />
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </BusinessLineProvider>
      </OrganizationProvider>
    </UserProvider>
  );
}
