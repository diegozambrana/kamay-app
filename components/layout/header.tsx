"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navEntriesFor } from "@/components/layout/nav-entries";
import { ThemeToggle } from "@/components/theme-toggle";
import { LineSelector } from "@/features/business-lines/line-selector";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organization-store";
import { useUserStore } from "@/stores/user-store";

/** Barra superior de escritorio: organización, contexto de línea y menú por rol. */
export function Header() {
  const organization = useOrganizationStore((state) => state.organization);
  const role = useUserStore((state) => state.membership?.role);
  const pathname = usePathname();

  const entries = navEntriesFor(role);

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

      <LineSelector />

      <nav aria-label="Navegación principal" className="flex-1">
        <ul className="flex items-center gap-1">
          {entries.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  pathname.startsWith(entry.href) && "bg-muted text-foreground",
                )}
              >
                {entry.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ThemeToggle />
    </header>
  );
}
