"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { useOrganizationStore } from "@/stores/organization-store";

/** Barra superior de escritorio. La navegación llega con cada feature. */
export function Header() {
  const organization = useOrganizationStore((state) => state.organization);

  return (
    <header
      data-testid="top-bar"
      className="sticky top-0 z-40 hidden h-14 items-center gap-4 border-b bg-background px-6 md:flex"
    >
      <span className="font-semibold">Kamay</span>
      {organization && (
        <span className="text-sm text-muted-foreground">
          {organization.name}
        </span>
      )}
      <nav aria-label="Navegación principal" className="flex-1">
        {/* Navegación vacía: cada feature añade sus entradas. */}
      </nav>
      <ThemeToggle />
    </header>
  );
}
