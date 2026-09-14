"use client";

import { Building2Icon, CheckIcon, ChevronsUpDownIcon, LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { enterOrganization } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { matchesName } from "@/lib/platform/users";
import type { OrganizationOption } from "@/services/platform/platform-service";

export const PLATFORM_VIEW_LABEL = "Vista de plataforma";

/**
 * Selector de organización del menú lateral, **solo para el administrador de
 * la plataforma** (KAM-26, design D8). Quien pertenece a varias
 * organizaciones sin ser super admin sigue cambiando por `/auth/select-org`.
 *
 * Elegir una organización la vuelve la activa y lleva a su panel con la vista
 * de su dueño; "Vista de plataforma" la quita y lleva a *Organizaciones*.
 *
 * Es un `DropdownMenu` con un filtro arriba y no un combobox: `command` y
 * `popover` no están instalados y una lista de decenas de talleres no los
 * necesita. Con el menú plegado queda el botón como icono, y su tooltip
 * nombra la organización activa.
 */
export function OrganizationSwitcher({
  organizations,
  hasMore = false,
  activeOrganizationId,
  activeOrganizationName = null,
}: {
  organizations: OrganizationOption[];
  /** El selector trae un tope de organizaciones; si hay más, lo dice. */
  hasMore?: boolean;
  activeOrganizationId: string | null;
  /** El nombre de la activa, que puede quedar fuera del tope de opciones. */
  activeOrganizationName?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const active = organizations.find((o) => o.id === activeOrganizationId) ?? null;
  const label =
    (activeOrganizationId && (activeOrganizationName ?? active?.name)) || PLATFORM_VIEW_LABEL;
  const visible = useMemo(
    () => organizations.filter((o) => matchesName(o.name, query)),
    [organizations, query],
  );

  function choose(organizationId: string | null) {
    if (organizationId === activeOrganizationId) return;
    startTransition(async () => {
      await enterOrganization(organizationId);
    });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              data-testid="organization-switcher"
              tooltip={`Organización: ${label}`}
              aria-label={`Organización activa: ${label}. Cambiar de organización`}
              disabled={pending}
              className="border"
            >
              <Building2Icon aria-hidden />
              <span className="truncate">{label}</span>
              <ChevronsUpDownIcon className="ml-auto" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
            {/* El filtro no es un ítem del menú: sin detener la propagación,
                cada letra movería el foco al ítem que empieza con ella. Solo
                se detienen los caracteres: Escape, Tab y las flechas siguen
                llegando al menú, que se cierra y se recorre con el teclado. */}
            <div
              className="px-1 pb-1"
              onKeyDown={(event) => {
                if (event.key.length === 1) event.stopPropagation();
              }}
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar organización"
                aria-label="Buscar organización"
                className="h-8"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {visible.map((organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  onSelect={() => choose(organization.id)}
                  data-testid="organization-switcher-option"
                >
                  <span className="truncate">{organization.name}</span>
                  {organization.id === activeOrganizationId && (
                    <CheckIcon className="ml-auto" aria-label="Activa" />
                  )}
                </DropdownMenuItem>
              ))}
              {visible.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Ninguna organización coincide.
                </p>
              )}
            </div>
            {hasMore && (
              <DropdownMenuItem asChild>
                <Link href="/admin/organizations">Ver todas en Organizaciones</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => choose(null)}>
              <LayoutGridIcon aria-hidden />
              {PLATFORM_VIEW_LABEL}
              {activeOrganizationId === null && <CheckIcon className="ml-auto" aria-label="Activa" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
