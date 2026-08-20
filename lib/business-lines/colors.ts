import { LINE_COLORS, type LineColor } from "@/types";

/**
 * Tailwind 4 no genera clases por interpolación: `bg-${color}-500` no existe en
 * el CSS final. Por eso el color de una línea es un token en la base y aquí se
 * traduce a clases literales, con `zinc` de respaldo ante un token desconocido
 * (un color retirado de la lista no debe romper una pantalla).
 */
type LineColorClasses = {
  /** Punto o barra de color junto al nombre de la línea. */
  dot: string;
  /** Etiqueta con fondo suave, para chips y encabezados. */
  badge: string;
};

const CLASSES: Record<LineColor, LineColorClasses> = {
  zinc: {
    dot: "bg-zinc-500",
    badge: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
  },
  blue: {
    dot: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100",
  },
  violet: {
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-100",
  },
  orange: {
    dot: "bg-orange-500",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-100",
  },
  green: {
    dot: "bg-green-500",
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100",
  },
  rose: {
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-100",
  },
  amber: {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100",
  },
  cyan: {
    dot: "bg-cyan-500",
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-100",
  },
};

export function lineColorClasses(color: string): LineColorClasses {
  return CLASSES[color as LineColor] ?? CLASSES.zinc;
}

export function isLineColor(value: string): value is LineColor {
  return (LINE_COLORS as readonly string[]).includes(value);
}

/** Nombre visible del color, para el selector de la pantalla de configuración. */
export const LINE_COLOR_LABELS: Record<LineColor, string> = {
  zinc: "Gris",
  blue: "Azul",
  violet: "Violeta",
  orange: "Naranja",
  green: "Verde",
  rose: "Rosa",
  amber: "Ámbar",
  cyan: "Turquesa",
};
