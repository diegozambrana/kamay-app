import { ALL_LINES, type ActiveLine, type BusinessLine } from "@/types";

/**
 * Qué línea le toca a una tarea creada por el alta rápida.
 *
 * `ask` significa que el compositor tiene que pedirla; cualquier otra cosa es
 * una línea resuelta sin preguntar.
 */
export type QuickAddLine =
  | { kind: "resolved"; businessLineId: string }
  | { kind: "ask" };

/**
 * El alta rápida tiene que caber en tres interacciones —abrir, escribir,
 * confirmar— y la línea es obligatoria, así que con el selector en «Todas» hay
 * que resolverla sin preguntar.
 *
 * Se usa la **línea compartida**: una tarea anotada mientras se miran todas las
 * líneas es, por definición, una que todavía no se ha adscrito a ninguna, y eso
 * es exactamente lo que el modelo conceptual reserva para General/Compartido.
 * Elegir la primera de la lista la archivaría en Sublimación sin decírselo a
 * nadie, que es peor que preguntar.
 *
 * La línea queda visible en la tarjeta y es modificable desde el panel, así que
 * corregirla no cuesta nada.
 *
 * Si la organización no tiene línea compartida, se pide: el alta pasa a cuatro
 * interacciones. Es una degradación honesta, no un fallo.
 */
export function resolveQuickAddLine(
  activeLine: ActiveLine | null,
  lines: BusinessLine[],
): QuickAddLine {
  if (activeLine && activeLine !== ALL_LINES) {
    return { kind: "resolved", businessLineId: activeLine };
  }

  const shared = lines.find((line) => line.isShared && !line.archivedAt);
  return shared
    ? { kind: "resolved", businessLineId: shared.id }
    : { kind: "ask" };
}
