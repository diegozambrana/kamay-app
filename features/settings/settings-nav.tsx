"use client";

import {
  BellIcon,
  Building2Icon,
  DownloadIcon,
  HistoryIcon,
  LayersIcon,
  RulerIcon,
  ShapesIcon,
  StoreIcon,
  TagsIcon,
  UsersIcon,
  WorkflowIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type SettingsGroup = "Organización" | "Equipo" | "Preferencias" | "Datos";

type SettingsSection = {
  href: string;
  label: string;
  group: SettingsGroup;
  icon: LucideIcon;
  ownerOnly: boolean;
};

/**
 * Secciones de V15. Cada una es su propia dirección: se puede enlazar y
 * compartir.
 *
 * `ownerOnly` distingue la configuración **del taller** —que es del dueño— de
 * las preferencias **de la persona**, que son de cada quien (design D1). Hasta
 * KAM-17 la distinción no hacía falta porque todo era lo primero.
 *
 * `group` ordena el menú en bloques con título (design D10): diez entradas
 * seguidas se leen peor que cuatro grupos. Van en el orden de sus grupos,
 * que es el orden en que se pintan.
 */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { href: "/settings/general", label: "General", group: "Organización", icon: Building2Icon, ownerOnly: true },
  { href: "/settings/lines", label: "Líneas de negocio", group: "Organización", icon: LayersIcon, ownerOnly: true },
  { href: "/settings/channels", label: "Canales", group: "Organización", icon: StoreIcon, ownerOnly: true },
  // Dos listas de categorías con nombres distintos, para que ninguna se confunda
  // con la otra (cambio `item-categories`).
  { href: "/settings/categories", label: "Categorías de gasto", group: "Organización", icon: TagsIcon, ownerOnly: true },
  { href: "/settings/item-categories", label: "Categorías de ítem", group: "Organización", icon: ShapesIcon, ownerOnly: true },
  { href: "/settings/units", label: "Unidades", group: "Organización", icon: RulerIcon, ownerOnly: true },
  { href: "/settings/statuses", label: "Estados", group: "Organización", icon: WorkflowIcon, ownerOnly: true },
  { href: "/settings/members", label: "Usuarios y roles", group: "Equipo", icon: UsersIcon, ownerOnly: true },
  { href: "/settings/notifications", label: "Notificaciones", group: "Preferencias", icon: BellIcon, ownerOnly: false },
  { href: "/settings/retention", label: "Retención", group: "Datos", icon: HistoryIcon, ownerOnly: true },
  // KAM-23 · Para los dos roles: cada quien exporta lo que puede leer.
  { href: "/settings/export", label: "Exportar", group: "Datos", icon: DownloadIcon, ownerOnly: false },
];

/**
 * El menú de secciones (spec `settings-interaction` → *Settings sections are
 * navigated from a side menu*).
 *
 * Un solo `<nav>` que cambia de forma (design D10): desde `lg` es una columna
 * fija con un título por grupo; por debajo, una fila que se desplaza a lo
 * ancho, sin títulos, con la sección actual llevada a la vista. Dos menús —uno
 * por tamaño— duplicarían cada enlace.
 *
 * La lista es plana: el título de un grupo es un `<li>` más, oculto en la
 * fila. Anidar una lista por grupo y aplanarla con `display: contents` rompe
 * la semántica de lista en Safari.
 *
 * Al ayudante le quedan dos secciones, y se acepta: un menú corto es más
 * honesto que ocultarlo y dejarlo sin saber dónde está.
 */
export function SettingsNav({ isOwner = true }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const current = useRef<HTMLAnchorElement>(null);

  const sections = SETTINGS_SECTIONS.filter((section) => isOwner || !section.ownerOnly);

  // En la fila del celular, la sección actual puede quedar fuera de la
  // pantalla (Usuarios y roles es la séptima): se centra al llegar. En la
  // columna ya está a la vista y `block: "nearest"` no mueve nada.
  useEffect(() => {
    current.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <nav
      aria-label="Secciones de configuración"
      className="-mx-4 min-w-0 border-b md:-mx-6 lg:sticky lg:top-20 lg:mx-0 lg:self-start lg:border-b-0"
    >
      <ul className="flex gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:px-6 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
        {sections.map((section, index) => {
          const active = pathname === section.href;
          const Icon = section.icon;
          const startsGroup = index === 0 || sections[index - 1].group !== section.group;

          return (
            <Fragment key={section.href}>
              {startsGroup && (
                <li
                  className={cn(
                    "hidden px-3 pb-1 text-xs font-medium text-muted-foreground lg:block",
                    index > 0 && "pt-5",
                  )}
                >
                  {section.group}
                </li>
              )}
              <li className="shrink-0">
                <Link
                  ref={active ? current : undefined}
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                    active && "bg-muted font-medium text-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {section.label}
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
