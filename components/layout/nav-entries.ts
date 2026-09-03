import {
  ClipboardListIcon,
  LayoutDashboardIcon,
  PackageIcon,
  PlusCircleIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/types";

export type NavEntry = {
  href: string;
  label: string;
  /** Icono del menú lateral. En la barra inferior solo se usa el texto. */
  icon: LucideIcon;
  /** Roles que ven la entrada. Lo que un rol no puede usar, no aparece. */
  roles: Role[];
};

/**
 * Entradas del menú principal (mapa de navegación §4.1). Cada tarea añade las
 * suyas; hoy existen el panel, el registro rápido, los pedidos, el catálogo,
 * los contactos y la configuración. Pedidos, catálogo y contactos son de la
 * navegación base: ambos roles trabajan con ellos (matriz de acceso §16).
 */
export const NAV_ENTRIES: NavEntry[] = [
  {
    href: "/dashboard",
    label: "Panel",
    icon: LayoutDashboardIcon,
    roles: ["owner", "assistant"],
  },
  {
    href: "/quick",
    label: "Registrar",
    icon: PlusCircleIcon,
    roles: ["owner", "assistant"],
  },
  {
    href: "/orders",
    label: "Pedidos",
    icon: ClipboardListIcon,
    roles: ["owner", "assistant"],
  },
  {
    href: "/catalog",
    label: "Catálogo",
    icon: PackageIcon,
    roles: ["owner", "assistant"],
  },
  {
    href: "/contacts",
    label: "Contactos",
    icon: UsersIcon,
    roles: ["owner", "assistant"],
  },
  {
    href: "/settings",
    label: "Configuración",
    icon: SettingsIcon,
    roles: ["owner"],
  },
];

/**
 * Menú de un rol. Ocultar la opción es mejor que mostrarla deshabilitada: un
 * menú lleno de puertas cerradas es una invitación a intentarlo (§4.4).
 */
export function navEntriesFor(role: Role | null | undefined): NavEntry[] {
  if (!role) return [];
  return NAV_ENTRIES.filter((entry) => entry.roles.includes(role));
}

/**
 * ¿La entrada corresponde a la ruta actual?
 *
 * Por segmento, no por prefijo de cadena: `startsWith("/quick")` marcaría
 * también una futura `/quick-sale`, y el resaltado del menú mentiría.
 */
export function isNavEntryActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
