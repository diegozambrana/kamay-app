import { ALL_LINES, type ActiveLine, type BusinessLine } from "@/types";

/**
 * Resuelve la línea activa antes del primer render (D5).
 *
 * Una cookie ausente, el literal `all`, una línea archivada o una que no
 * pertenece a la organización actual resuelven todas a "Todas": el valor
 * obsoleto se ignora y se sobrescribe la próxima vez que el usuario elija —
 * el render de un Server Component no puede fijar cookies.
 */
export function resolveActiveLine(
  cookieValue: string | undefined,
  activeLines: BusinessLine[],
): ActiveLine {
  if (!cookieValue || cookieValue === ALL_LINES) return ALL_LINES;

  const found = activeLines.find((line) => line.id === cookieValue);
  return found ? found.id : ALL_LINES;
}

/** La línea activa como entidad, o `null` cuando el contexto es "Todas". */
export function findActiveLine(
  activeLine: ActiveLine,
  activeLines: BusinessLine[],
): BusinessLine | null {
  if (activeLine === ALL_LINES) return null;
  return activeLines.find((line) => line.id === activeLine) ?? null;
}

/**
 * Valor a preseleccionar en un formulario de creación: la línea activa, o nada
 * cuando el contexto es "Todas" (ahí el usuario debe elegir explícitamente).
 */
export function preselectedLineId(activeLine: ActiveLine): string | undefined {
  return activeLine === ALL_LINES ? undefined : activeLine;
}
