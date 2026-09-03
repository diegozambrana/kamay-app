"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavEntryActive, navEntriesFor } from "@/components/layout/nav-entries";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LineSelector } from "@/features/business-lines/line-selector";
import { useUserStore } from "@/stores/user-store";

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
 */
export function AppSidebar() {
  const role = useUserStore((state) => state.membership?.role);
  const pathname = usePathname();

  const entries = navEntriesFor(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-2">
        {/* Solo la marca: la organización activa la dice la barra superior, y
            repetirla aquí la pone dos veces en la misma pantalla. */}
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:hidden">
          <span className="font-semibold">Kamay</span>
        </div>

        {/* El contexto de línea acompaña al usuario por todas las secciones,
            así que encabeza el menú en vez de vivir dentro de una pantalla. */}
        <div className="group-data-[collapsible=icon]:hidden">
          <LineSelector />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {/* El landmark con nombre es parte del contrato de accesibilidad de
              la navegación principal, no decoración. */}
          <nav aria-label="Navegación principal">
            <SidebarMenu>
              {entries.map((entry) => {
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
              })}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
