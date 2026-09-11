/**
 * La exportación de la bitácora: su techo y su nombre de archivo.
 *
 * **No hay serializador CSV aquí.** `toCsv()` de `lib/reports/csv.ts` ya
 * resuelve el escapado de RFC 4180, el BOM que evita que Excel abra
 * «Sublimación» como «SublimaciÃ³n» y las cifras sin formato de moneda; KAM-20
 * lo escribió y funciona (design D6). Lo único que la bitácora no puede
 * heredar es `csvFilename()`, que arma nombres de informe.
 */

/**
 * Cuántos eventos como mucho salen en un archivo.
 *
 * No es una cifra de rendimiento sino de honestidad: por encima de esto la
 * pantalla **avisa** en vez de entregar un archivo recortado que parece
 * completo. Quien necesita más acota por fechas, que es lo que de todos modos
 * iba a hacer para leerlo.
 */
export const MAX_EXPORT_ROWS = 5000;

/** Las columnas del archivo, en su orden. */
export const EXPORT_HEADERS = [
  "Fecha",
  "Autor",
  "Qué pasó",
  "Registro",
  "Línea",
  "Origen",
  "Detalle del cambio",
] as const;

/** `bitacora-2026-08-17_2026-08-19.csv`, o `bitacora-completa.csv`. */
export function activityExportFilename(range: {
  from: string | null;
  to: string | null;
}): string {
  if (range.from && range.to) return `bitacora-${range.from}_${range.to}.csv`;
  if (range.from) return `bitacora-desde-${range.from}.csv`;
  if (range.to) return `bitacora-hasta-${range.to}.csv`;
  return "bitacora-completa.csv";
}

/**
 * El periodo tal como se escribe dentro del archivo.
 *
 * Va **en el archivo** y no solo en su nombre por la misma razón que en los
 * informes: un archivo suelto en el escritorio de alguien tiene que poder
 * explicarse solo.
 */
export function exportPeriodLabel(range: {
  from: string | null;
  to: string | null;
}): string {
  if (range.from && range.to) return `${range.from} a ${range.to}`;
  if (range.from) return `Desde ${range.from}`;
  if (range.to) return `Hasta ${range.to}`;
  return "Toda la bitácora";
}

/** ¿El resultado cabe? Quien llama avisa antes de producir nada. */
export function fitsExport(total: number): boolean {
  return total <= MAX_EXPORT_ROWS;
}
