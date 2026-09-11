"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Secciones de V15. Cada una es su propia dirección: se puede enlazar y
 * compartir, y KAM-05 añadirá Estados (V22) sin tocar nada de esto.
 *
 * `ownerOnly` distingue la configuración **del taller** —que es del dueño— de
 * las preferencias **de la persona**, que son de cada quien (design D1). Hasta
 * KAM-17 la distinción no hacía falta porque todo era lo primero.
 */
export const SETTINGS_SECTIONS = [
  { href: "/settings/general", label: "General", ownerOnly: true },
  { href: "/settings/lines", label: "Líneas de negocio", ownerOnly: true },
  { href: "/settings/channels", label: "Canales", ownerOnly: true },
  { href: "/settings/categories", label: "Categorías", ownerOnly: true },
  { href: "/settings/units", label: "Unidades", ownerOnly: true },
  { href: "/settings/statuses", label: "Estados", ownerOnly: true },
  { href: "/settings/members", label: "Usuarios y roles", ownerOnly: true },
  { href: "/settings/retention", label: "Retención", ownerOnly: true },
  { href: "/settings/notifications", label: "Notificaciones", ownerOnly: false },
] as const;

/**
 * Al ayudante le queda una sola pestaña, y se acepta: una pestaña sola es más
 * honesta que ocultar la navegación y dejarlo sin saber dónde está.
 */
export function SettingsNav({ isOwner = true }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const sections = SETTINGS_SECTIONS.filter(
    (section) => isOwner || !section.ownerOnly,
  );

  return (
    <nav aria-label="Secciones de configuración" className="mt-6 border-b">
      <ul className="flex flex-wrap gap-1">
        {sections.map((section) => (
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
