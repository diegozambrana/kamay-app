"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavEntryActive, navEntriesFor } from "@/components/layout/nav-entries";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

/**
 * Barra inferior móvil: las mismas entradas del menú lateral, filtradas por
 * el mismo rol — `nav-entries.ts` es la única fuente de ambos.
 *
 * Icono arriba y rótulo pequeño debajo: con seis secciones, los rótulos en
 * una sola línea ya no caben en un teléfono y la última se cortaba.
 */
export function MobileNav() {
  const role = useUserStore((state) => state.membership?.role);
  const pathname = usePathname();

  const entries = navEntriesFor(role);

  return (
    <nav
      data-testid="bottom-bar"
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t bg-background md:hidden"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        const active = isNavEntryActive(entry.href, pathname);

        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-muted-foreground",
              active && "text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="w-full truncate text-center text-[0.625rem] leading-none">
              {entry.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
