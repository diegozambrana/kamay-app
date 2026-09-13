/**
 * Listas acotadas (KAM-23, spec `performance-budget` → *No data view loads an
 * entire table*).
 *
 * Ninguna vista pide una tabla entera: pide una ventana con un límite
 * explícito, y trae más cuando la persona lo pide. El límite viaja en la
 * dirección —`?limit=100`, `?closed=100`— para que «Mostrar más» sea una
 * navegación dentro de la aplicación, sin recargar la vista, y para que el
 * enlace de una lista ampliada siga siéndolo.
 */

/** Cuántas filas trae cada vuelta. */
export const PAGE_SIZE = 50;

/**
 * El techo de una ventana ampliada a mano. Pedir mil filas a propósito es
 * posible; pedir la tabla entera escribiendo un número en la dirección, no.
 */
export const MAX_LIMIT = 1000;

/**
 * El techo de lo que una vista muestra **sin ventana**: el trabajo abierto de
 * un tablero, que un taller mantiene acotado por su propia capacidad. No es
 * un límite de producto sino una red de seguridad contra una consulta
 * desbocada.
 */
export const OPEN_WORK_CAP = 500;

/**
 * El límite que pide la dirección, redondeado a vueltas enteras y dentro de
 * `[pageSize, MAX_LIMIT]`. Lo que no es un número entero cae en una vuelta.
 */
export function resolveLimit(raw: string | null | undefined, pageSize = PAGE_SIZE): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < pageSize) return pageSize;
  const rounded = Math.ceil(parsed / pageSize) * pageSize;
  return Math.min(rounded, MAX_LIMIT);
}

/**
 * Recorta a `limit` una lista pedida con `limit + 1` filas y dice si había
 * más. Pedir una de más es la forma barata de saberlo sin un segundo conteo.
 */
export function takeWindow<T>(rows: T[], limit: number): { rows: T[]; hasMore: boolean } {
  return rows.length > limit
    ? { rows: rows.slice(0, limit), hasMore: true }
    : { rows, hasMore: false };
}

/**
 * Parte una lista de identificadores en tandas.
 *
 * Un filtro `in (…)` viaja en la dirección de la petición a PostgREST, y cien
 * UUID ya son casi cuatro mil caracteres: con un año de pedidos, la consulta
 * de totales del tablero llegó a responder `414 URI too long` (hallazgo de
 * KAM-23). Toda consulta por lista de identificadores va en tandas.
 */
export function chunk<T>(values: readonly T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}
