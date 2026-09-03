"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useOrganizationStore } from "@/stores/organization-store";

/**
 * Barra superior de escritorio. Desde que la navegación vive en el menú
 * lateral solo le quedan tres cosas: plegar el menú, decir en qué
 * organización estás y cambiar el tema.
 *
 * Sigue siendo `md:flex`, así que en móvil no existe — allí manda la barra
 * inferior. El disparador del menú lateral vive solo aquí, de modo que en
 * móvil nada puede abrirlo y el panel lateral queda inerte sin necesidad de
 * condicionales.
 */
export function Header() {
  const organization = useOrganizationStore((state) => state.organization);

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-40 hidden h-14 items-center gap-3 border-b bg-background px-4 md:flex"
    >
      <SidebarTrigger />

      {organization && (
        <span className="text-sm text-muted-foreground">
          {organization.name}
        </span>
      )}

      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
