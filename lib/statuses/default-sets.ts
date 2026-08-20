import type { LineColor, StatusFlow, StatusKind } from "@/types";

export type DefaultStatus = {
  name: string;
  kind: StatusKind;
  color: LineColor;
  isQueue: boolean;
  position: number;
};

/**
 * Los juegos por defecto de V22 ("restaurar valores por defecto"). Fuente
 * única del lado de la aplicación: la base los recibe como jsonb en
 * `restore_default_statuses()`. Los juegos reales de Geeko Store son datos de
 * la semilla (supabase/seed.sql), no valores por defecto del sistema.
 */
export const DEFAULT_STATUS_SETS: Record<StatusFlow, DefaultStatus[]> = {
  task: [
    { name: "Por hacer", kind: "initial", color: "zinc", isQueue: false, position: 1 },
    { name: "Haciendo", kind: "in_progress", color: "blue", isQueue: false, position: 2 },
    { name: "En revisión", kind: "waiting", color: "amber", isQueue: false, position: 3 },
    { name: "Hecho", kind: "final", color: "green", isQueue: false, position: 4 },
  ],
  order: [
    { name: "Registrado", kind: "initial", color: "zinc", isQueue: false, position: 1 },
    { name: "En curso", kind: "in_progress", color: "blue", isQueue: false, position: 2 },
    { name: "Listo para entrega", kind: "waiting", color: "amber", isQueue: false, position: 3 },
    { name: "Entregado", kind: "final", color: "green", isQueue: false, position: 4 },
    { name: "Cancelado", kind: "cancelled", color: "rose", isQueue: false, position: 5 },
  ],
};

/** La forma que espera el parámetro jsonb de `restore_default_statuses()`. */
export function defaultSetAsJson(flow: StatusFlow) {
  return DEFAULT_STATUS_SETS[flow].map((status) => ({
    name: status.name,
    kind: status.kind,
    color: status.color,
    is_queue: status.isQueue,
    position: status.position,
  }));
}
