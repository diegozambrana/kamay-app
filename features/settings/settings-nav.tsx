"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Secciones de V15. Cada una es su propia dirección: se puede enlazar y
 * compartir, y KAM-05 añadirá Estados (V22) sin tocar nada de esto.
 */
export const SETTINGS_SECTIONS = [
  { href: "/settings/general", label: "General" },
  { href: "/settings/lines", label: "Líneas de negocio" },
  { href: "/settings/channels", label: "Canales" },
  { href: "/settings/categories", label: "Categorías" },
  { href: "/settings/units", label: "Unidades" },
  { href: "/settings/statuses", label: "Estados" },
  { href: "/settings/members", label: "Usuarios y roles" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de configuración" className="mt-6 border-b">
      <ul className="flex flex-wrap gap-1">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              aria-current={pathname === section.href ? "page" : undefined}
              className={cn(
                "-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                pathname === section.href &&
                  "border-foreground text-foreground",
              )}
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
