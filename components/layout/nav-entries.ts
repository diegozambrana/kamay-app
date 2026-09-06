import {
  ClipboardListIcon,
  HomeIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PackageIcon,
  ReceiptIcon,
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
  /**
   * Rótulo de la ranura en la barra inferior, cuando difiere del de escritorio.
   *
   * El registro rápido es "Registrar" en el menú lateral —donde compite con
   * Panel, que es la puerta de entrada del escritorio (mapa §4.1)— y "Inicio"
   * en el celular, donde sí es la puerta de entrada (§4.2). Es la misma
   * entrada dicha con la palabra que corresponde a cada superficie, no dos
   * entradas.
   */
  barLabel?: string;
  /** Roles que ven la entrada. Lo que un rol no puede usar, no aparece. */
  roles: Role[];
  /**
   * Dónde vive la entrada en el celular: en una ranura de la barra inferior
   * o dentro del panel "Más" (mapa §4.2).
   *
   * Es un campo y no una lista aparte a propósito: la barra, el panel y el
   * menú lateral salen todos de esta misma declaración, así que no pueden
   * ofrecer cosas distintas ni desincronizarse (design D2).
   */
  mobile: "bar" | "more";
};

/**
 * Entradas del menú principal (mapa de navegación §4.1). Cada tarea añade las
 * suyas; hoy existen el registro rápido, los pedidos, las tareas, el panel,
 * los egresos, el catálogo, los contactos y la configuración. Pedidos,
 * catálogo y contactos son de la navegación base: ambos roles trabajan con
 * ellos (matriz de acceso §16); egresos y configuración son del dueño.
 *
 * El orden es el del menú lateral de escritorio. En el celular manda el campo
 * `mobile`, y las tres entradas `bar` van en el orden en que aparecen aquí.
 */
export const NAV_ENTRIES: NavEntry[] = [
  {
    // Primera ranura de la barra inferior: en el celular la puerta de entrada
    // es la captura, no el panel (mapa §2.1).
    href: "/quick",
    label: "Registrar",
    barLabel: "Inicio",
    icon: HomeIcon,
    roles: ["owner", "assistant"],
    mobile: "bar",
  },
  {
    href: "/orders",
    label: "Pedidos",
    icon: ClipboardListIcon,
    roles: ["owner", "assistant"],
    mobile: "bar",
  },
  {
    // Tercera ranura. Apunta a *Mis pendientes*, no al tablero: en el celular
    // interesa "qué hago hoy" (mapa §4.2). La pantalla llega en KAM-17; hoy
    // es un cascarón, pero la ranura ya no vuelve a moverse.
    href: "/my-tasks",
    label: "Tareas",
    icon: ListChecksIcon,
    roles: ["owner", "assistant"],
    mobile: "bar",
  },
  {
    // En escritorio el panel es la puerta de entrada y encabeza el menú; en
    // el celular vive bajo "Más", porque su ranura la ocupa la captura.
    href: "/dashboard",
    label: "Panel",
    icon: LayoutDashboardIcon,
    roles: ["owner", "assistant"],
    mobile: "more",
  },
  {
    // Grupo "Dinero" del mapa §4.1: solo el dueño. Los costos viven en
    // `expenses`, tabla sin política de lectura para el ayudante (§16).
    href: "/expenses",
    label: "Egresos",
    icon: ReceiptIcon,
    roles: ["owner"],
    mobile: "more",
  },
  {
    href: "/catalog",
    label: "Catálogo",
    icon: PackageIcon,
    roles: ["owner", "assistant"],
    mobile: "more",
  },
  {
    href: "/contacts",
    label: "Contactos",
    icon: UsersIcon,
    roles: ["owner", "assistant"],
    mobile: "more",
  },
  {
    href: "/settings",
    label: "Configuración",
    icon: SettingsIcon,
    roles: ["owner"],
    mobile: "more",
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

/**
 * Las entradas que ocupan ranura en la barra inferior del celular.
 *
 * Son tres —Inicio, Pedidos, Tareas—; la cuarta ranura la ocupa "Más", que no
 * es una entrada de navegación sino el disparador de su panel. Que sean tres
 * y no cuatro es lo que impide que una tarea futura cuele una sección más en
 * la barra sin que nadie se dé cuenta (design D2).
 */
export function bottomBarEntriesFor(role: Role | null | undefined): NavEntry[] {
  return navEntriesFor(role).filter((entry) => entry.mobile === "bar");
}

/** El rótulo que le toca a la entrada en la barra inferior. */
export function barLabelOf(entry: NavEntry): string {
  return entry.barLabel ?? entry.label;
}

/** Las entradas que viven dentro del panel "Más" del celular. */
export function moreEntriesFor(role: Role | null | undefined): NavEntry[] {
  return navEntriesFor(role).filter((entry) => entry.mobile === "more");
}
