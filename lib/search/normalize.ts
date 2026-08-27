/**
 * Normalización de búsqueda por nombre.
 *
 * El usuario escribe "sublimacion" y espera encontrar "Taza para sublimación".
 * La misma regla corre en los dos lados: aquí para preparar el término que se
 * envía a la base (que lo compara contra `immutable_unaccent(lower(name))`) y
 * aquí también para filtrar en memoria. Que sea una sola función es lo que
 * garantiza que servidor y cliente den el mismo resultado.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    // Marcas diacríticas combinantes: es lo que NFD separó de cada letra.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** ¿El nombre contiene el término, ignorando acentos y mayúsculas? */
export function matchesSearch(name: string, term: string): boolean {
  const needle = normalizeForSearch(term);
  if (needle === "") return true;
  return normalizeForSearch(name).includes(needle);
}
