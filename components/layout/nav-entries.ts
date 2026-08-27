import type { Role } from "@/types";

export type NavEntry = {
  href: string;
  label: string;
  /** Roles que ven la entrada. Lo que un rol no puede usar, no aparece. */
  roles: Role[];
};

/**
 * Entradas del menú principal (mapa de navegación §4.1). Cada tarea añade las
 * suyas; hoy existen el panel, el registro rápido, el catálogo, los contactos
 * y la configuración. Catálogo y Contactos son de la navegación base: ambos
 * roles trabajan con ellos.
 */
export const NAV_ENTRIES: NavEntry[] = [
  { href: "/dashboard", label: "Panel", roles: ["owner", "assistant"] },
  { href: "/quick", label: "Registrar", roles: ["owner", "assistant"] },
  { href: "/catalog", label: "Catálogo", roles: ["owner", "assistant"] },
  { href: "/contacts", label: "Contactos", roles: ["owner", "assistant"] },
  { href: "/settings", label: "Configuración", roles: ["owner"] },
];

/**
 * Menú de un rol. Ocultar la opción es mejor que mostrarla deshabilitada: un
 * menú lleno de puertas cerradas es una invitación a intentarlo (§4.4).
 */
export function navEntriesFor(role: Role | null | undefined): NavEntry[] {
  if (!role) return [];
  return NAV_ENTRIES.filter((entry) => entry.roles.includes(role));
}
