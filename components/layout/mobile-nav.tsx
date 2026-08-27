"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navEntriesFor } from "@/components/layout/nav-entries";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

/** Barra inferior móvil: las mismas entradas del menú, filtradas por rol. */
export function MobileNav() {
  const role = useUserStore((state) => state.membership?.role);
  const pathname = usePathname();

  const entries = navEntriesFor(role);

  return (
    <nav
      data-testid="bottom-bar"
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t bg-background md:hidden"
    >
      {entries.map((entry) => (
        <Link
          key={entry.href}
          href={entry.href}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs text-muted-foreground",
            pathname.startsWith(entry.href) && "bg-muted text-foreground",
          )}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}
