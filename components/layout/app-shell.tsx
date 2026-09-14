import { cookies } from "next/headers";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { MobileContextBar } from "@/components/layout/mobile-context-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BusinessLineProvider } from "@/components/providers/business-line-provider";
import { OrganizationProvider } from "@/components/providers/organization-provider";
import { UserProvider } from "@/components/providers/user-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lineCookieName } from "@/constants/auth";
import { RegisterButton } from "@/features/quick-capture/register-button";
import { SyncProvider } from "@/features/sync/sync-provider";
import type { ActiveAccess } from "@/lib/auth/access";
import { resolveActiveLine } from "@/lib/business-lines/active-line";
import { createClient } from "@/lib/supabase/server";
import { ItemService } from "@/services/catalog/item-service";
import { BusinessLineService } from "@/services/configuration/business-line-service";
import {
  NotificationService,
  groupByType,
} from "@/services/notifications/notification-service";
import { PlatformService } from "@/services/platform/platform-service";
import type { CurrentUser, MembershipWithOrganization } from "@/types";

/**
 * El cascarón de la aplicación: menú lateral, barra superior, barra inferior
 * y botón *+ Registrar*, con los providers de sesión (KAM-26, design D7).
 *
 * Vivía dentro de `app/(app)/layout.tsx`. Sale de ahí porque ahora lo usan
 * tres layouts —`(app)`, `(platform)` y `(account)`— y no puede haber tres
 * copias del mismo cascarón.
 *
 * Con `access = null` —un administrador de la plataforma sin organización
 * activa— rinde el **cascarón reducido**: menú con las entradas de plataforma
 * y el selector, y menú de cuenta. Sin selector de línea, campana, registro ni
 * barra de contexto, que necesitan una organización: no ocultos, **no
 * montados** (spec `platform-administration` → *A platform admin without an
 * active organization gets the platform shell*).
 */
export async function AppShell({
  user,
  access,
  platformAdmin,
  memberships,
  children,
}: {
  user: CurrentUser;
  access: ActiveAccess | null;
  platformAdmin: boolean;
  memberships: MembershipWithOrganization[];
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const organizationId = access?.organizationId ?? null;

  // El contexto de línea se resuelve aquí, antes del primer render: ninguna
  // pantalla debe aparecer primero sin línea y cambiar después (D5).
  const lines = organizationId
    ? await new BusinessLineService(supabase).listActive(organizationId)
    : [];
  const activeLine = organizationId
    ? resolveActiveLine(cookieStore.get(lineCookieName(organizationId))?.value, lines)
    : null;

  /**
   * Los insumos que ofrece el diálogo de consumo del menú *+ Registrar*
   * (KAM-18). Se cargan aquí porque el botón flota en toda pantalla
   * autenticada y el diálogo no puede consultar desde el cliente.
   *
   * El catálogo de un taller cabe en una consulta —decenas de insumos, no
   * miles (§Volumen esperado)—, que es el mismo criterio con el que KAM-09
   * carga todos los últimos costos de una vez.
   */
  const supplies = organizationId
    ? await new ItemService(supabase).list(organizationId, { kind: "supply" })
    : [];

  // La bandeja y el contador se componen aquí, en el cascarón, porque la
  // campana es un elemento siempre disponible (mapa §4.1): cargarlos en cada
  // página los duplicaría, y cargarlos en el cliente haría parpadear el
  // contador en cada navegación.
  const notifications = organizationId
    ? await new NotificationService(supabase).list(organizationId)
    : [];
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Las opciones del selector de organización: solo para el super admin, y
  // con tope (si hay más, el selector manda a *Organizaciones*).
  const switcher = platformAdmin
    ? await new PlatformService(supabase).listActiveOrganizations()
    : { organizations: [], hasMore: false };

  // Ausente = desplegado, que es el valor por defecto de shadcn.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const membership = access?.membership
    ? {
        id: access.membership.id,
        organizationId: access.membership.organizationId,
        role: access.membership.role,
        displayName: access.membership.displayName,
      }
    : null;

  const shell = (
    // `SidebarProvider` es el shell: dispone menú y contenido en fila y
    // guarda el plegado en cookie. Cada página rinde su propio
    // `MainContainer`, que es quien pone el encabezado y el padding.
    // Los rótulos del menú plegado son tooltips de Radix, y esta versión de
    // `SidebarProvider` no trae su proveedor incorporado.
    <TooltipProvider delayDuration={0}>
      {/* El plegado lo escribe el cliente en `sidebar_state`, pero quien
          decide el primer render es el servidor: sin esto el menú aparecería
          desplegado y se plegaría de golpe tras hidratar. */}
      <SidebarProvider defaultOpen={sidebarOpen}>
        {/* Refleja la cola en el store y dispara el vaciado. Va dentro de los
            providers de sesión: sin organización y persona no puede decidir
            qué entrada sale — por eso tampoco se monta sin organización. */}
        {access && <SyncProvider />}
        <AppSidebar
          organizations={switcher.organizations}
          moreOrganizations={switcher.hasMore}
          activeOrganizationId={organizationId}
          activeOrganizationName={access?.organization.name ?? null}
        />
        {/* `min-w-0`: sin él, un contenido interno más ancho que la ventana
            (el tablero, por ejemplo) empuja este contenedor —que es un ítem
            flex— más allá del viewport en vez de dejar que su propio
            `overflow-x-auto` lo absorba. El síntoma es que la barra superior,
            al ser hermana en el mismo desborde, se mueve con el scroll
            horizontal en vez de quedarse fija.

            `overflow-x-clip`: `min-w-0` no bastaba. En 390 px el
            desbordamiento del tablero seguía llegando al documento, y con él
            crecía el bloque contenedor de los elementos `fixed` —la barra
            inferior y el botón flotante—, que aparecían a 567 px de ancho en
            una pantalla de 390. El recorte va aquí y no en `MainContainer`
            porque esos dos son hermanos suyos, no descendientes. `clip` y no
            `hidden`: `hidden` crearía un contexto de desplazamiento y rompería
            los encabezados `sticky`. */}
        <SidebarInset className="min-w-0 overflow-x-clip">
          <Header
            unreadCount={unreadCount}
            notificationGroups={groupByType(notifications)}
            timezone={access?.organization.timezone}
            organizationControls={Boolean(access)}
          />
          {access && <MobileContextBar />}
          {children}
          {/* Registrar está a un toque desde cualquier pantalla (mapa §2.6).
              Flota sobre la barra, no dentro de ella. */}
          {access && <RegisterButton supplies={supplies} />}
          <MobileNav />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );

  return (
    <UserProvider
      user={user}
      membership={membership}
      role={access?.role ?? null}
      platformAdmin={platformAdmin}
    >
      <OrganizationProvider
        organization={access?.organization ?? null}
        memberships={memberships}
      >
        {access && activeLine !== null ? (
          <BusinessLineProvider lines={lines} activeLine={activeLine}>
            {shell}
          </BusinessLineProvider>
        ) : (
          shell
        )}
      </OrganizationProvider>
    </UserProvider>
  );
}
