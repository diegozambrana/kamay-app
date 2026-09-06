import {
  BoxesIcon,
  ClipboardListIcon,
  ListChecksIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/types";

/**
 * Un destino de la retícula de registro rápido (V16).
 *
 * `href` ausente significa que la pantalla todavía no existe: el destino se
 * rinde igual, en su ranura y con su tamaño, pero inerte (design D7). Ocupar
 * la ranura desde el principio evita que la disposición cambie —y haya que
 * volver a verificar el alcance del pulgar— cada vez que llega una tarea.
 */
export type QuickDestination = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Ausente mientras el destino no exista. */
  href?: string;
  /** Roles que lo ven. Lo que un rol no puede usar, no aparece. */
  roles: Role[];
  /** Qué falta para que exista. Solo cuando no hay `href`. */
  availableFrom?: string;
};

/**
 * Los seis destinos de V16, en el orden de la retícula (mapa §5).
 *
 * Esta lista es la única fuente: la rinden la retícula de `/quick` y el menú
 * del botón *+ Registrar*, de modo que no puedan ofrecer cosas distintas
 * (design D1). Habilitar un destino pendiente es borrar su `availableFrom` y
 * darle `href` — no editar dos componentes.
 *
 * Compra y Gasto son solo del dueño: escriben en `expenses`, tabla sin
 * ninguna política para el ayudante (matriz de acceso del esquema).
 */
export const QUICK_DESTINATIONS: QuickDestination[] = [
  {
    key: "direct-sale",
    label: "Venta rápida",
    icon: ZapIcon,
    href: "/fair",
    roles: ["owner", "assistant"],
  },
  {
    key: "order",
    label: "Pedido",
    icon: ClipboardListIcon,
    href: "/orders/new",
    roles: ["owner", "assistant"],
  },
  {
    key: "purchase",
    label: "Compra",
    icon: ShoppingCartIcon,
    href: "/expenses/purchases/new",
    roles: ["owner"],
  },
  {
    key: "cost",
    label: "Gasto",
    icon: ReceiptIcon,
    href: "/expenses/costs/new",
    roles: ["owner"],
  },
  {
    key: "consumption",
    label: "Consumo",
    icon: BoxesIcon,
    roles: ["owner", "assistant"],
    availableFrom: "Llega con el inventario",
  },
  {
    key: "task",
    label: "Tarea",
    icon: ListChecksIcon,
    roles: ["owner", "assistant"],
    availableFrom: "Llega con las tareas",
  },
];

/**
 * Los destinos de un rol, en el orden de la retícula.
 *
 * Ocultar es mejor que deshabilitar cuando la razón es el rol (mapa §4.4):
 * un botón muerto invita a intentarlo. Deshabilitar sí es lo correcto cuando
 * la razón es que el producto aún no lo tiene, y eso lo dice `availableFrom`.
 */
export function destinationsFor(role: Role | null | undefined): QuickDestination[] {
  if (!role) return [];
  return QUICK_DESTINATIONS.filter((destination) => destination.roles.includes(role));
}

/** ¿El destino se puede activar hoy? */
export function isAvailable(destination: QuickDestination): boolean {
  return destination.href !== undefined;
}
