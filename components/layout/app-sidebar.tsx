"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  TOOLS_GROUP_LABEL,
  isNavEntryActive,
  navEntriesFor,
  type NavEntry,
} from "@/components/layout/nav-entries";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LineSelector } from "@/features/business-lines/line-selector";
import { OrganizationSwitcher } from "@/features/platform/organization-switcher";
import type { OrganizationOption } from "@/services/platform/platform-service";
import { useUserStore } from "@/stores/user-store";
import type { ToolNavItem } from "@/tools/types";

/**
 * Menú lateral de escritorio. Sustituye a la fila de enlaces de la barra
 * superior: una fila horizontal deja de dar de sí en cuanto entran Egresos,
 * Tareas, Reportes y Bitácora.
 *
 * Las entradas salen de `nav-entries.ts`, que sigue siendo la única fuente:
 * la barra inferior móvil lee exactamente la misma lista y el mismo filtro
 * por rol.
 *
 * Las secciones de Configuración **no** se despliegan aquí: viven en las
 * pestañas de `SettingsNav`. Duplicarlas daría dos enlaces con el mismo
 * nombre accesible en la página.
 *
 * Al administrador de la plataforma (KAM-26) el menú le suma el selector de
 * organización y las entradas Organizaciones y Usuarios; sin organización
 * activa, solo eso.
 *
 * Las herramientas activas (KAM-27) forman su propia sección, con título, y
 * **solo cuando hay alguna**: una organización que no activó ninguna ve el
 * menú exactamente como antes.
 */
export function AppSidebar({
  organizations = [],
  moreOrganizations = false,
  activeOrganizationId = null,
  activeOrganizationName = null,
  tools = [],
}: {
  /** Opciones del selector; solo llegan para el super admin. */
  organizations?: OrganizationOption[];
  /** Hay más organizaciones que las que caben en el selector. */
  moreOrganizations?: boolean;
  activeOrganizationId?: string | null;
  activeOrganizationName?: string | null;
  /** Herramientas activas que esta persona puede usar, ya filtradas por rol. */
  tools?: ToolNavItem[];
} = {}) {
  const role = useUserStore((state) => state.role);
  const platformAdmin = useUserStore((state) => state.platformAdmin);
  const pathname = usePathname();

  const entries = navEntriesFor(role, platformAdmin, tools);
  const mainEntries = entries.filter((entry) => entry.group !== "tools");
  const toolEntries = entries.filter((entry) => entry.group === "tools");

  const renderEntry = (entry: NavEntry) => {
    const Icon = entry.icon;
    return (
      <SidebarMenuItem key={entry.href}>
        <SidebarMenuButton
          asChild
          isActive={isNavEntryActive(entry.href, pathname)}
          tooltip={entry.label}
        >
          <Link href={entry.href}>
            <Icon aria-hidden />
            <span>{entry.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        {/* Solo la marca: la organización activa la dice la barra superior.
            La excepción es el super admin, para quien elegirla es parte de la
            navegación y no un dato: su selector va aquí, en el menú. */}
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:hidden">
          <span className="font-semibold">Kamay</span>
        </div>

        {platformAdmin && (
          <OrganizationSwitcher
            organizations={organizations}
            hasMore={moreOrganizations}
            activeOrganizationId={activeOrganizationId}
            activeOrganizationName={activeOrganizationName}
          />
        )}

        {/* El contexto de línea acompaña al usuario por todas las secciones,
            así que encabeza el menú en vez de vivir dentro de una pantalla.
            Sin organización activa no hay líneas que elegir. */}
        {role && (
          <div className="group-data-[collapsible=icon]:hidden">
            <LineSelector />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {/* El landmark con nombre es parte del contrato de accesibilidad de
              la navegación principal, no decoración. */}
          <nav aria-label="Navegación principal">
            <SidebarMenu>{mainEntries.map(renderEntry)}</SidebarMenu>
          </nav>
        </SidebarGroup>

        {toolEntries.length > 0 && (
          <SidebarGroup data-testid="sidebar-tools">
            <SidebarGroupLabel>{TOOLS_GROUP_LABEL}</SidebarGroupLabel>
            <nav aria-label={TOOLS_GROUP_LABEL}>
              <SidebarMenu>{toolEntries.map(renderEntry)}</SidebarMenu>
            </nav>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
