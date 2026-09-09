/**
 * Serialización de un informe a hoja de cálculo (KAM-20, design D8).
 *
 * CSV escrito a mano, sin dependencia: son unas decenas de líneas, y una
 * librería de XLSX añadiría peso y superficie de mantenimiento para producir
 * un formato que nadie pidió. El backlog dice "hoja de cálculo", y quien va a
 * seguir calculando prefiere números limpios a celdas con formato de moneda.
 *
 * Tres decisiones que parecen detalles y no lo son:
 * - **Comillas según RFC 4180**: un proveedor que se llama «Papeles, S.A.»
 *   parte la fila en dos si no se citan las comas.
 * - **UTF-8 con BOM**: sin él, Excel abre "Sublimación" como "SublimaciÃ³n".
 * - **Cifras sin formato**: el punto decimal y ningún símbolo de moneda, para
 *   que la columna se pueda sumar sin limpiarla.
 */

/** Una fila de contexto que precede a la tabla y la explica. */
export type CsvContext = {
  title: string;
  period: string;
  line: string;
  /** La leyenda del reparto, cuando el informe lo aplica. */
  legend?: string;
};

export type CsvTable = {
  headers: string[];
  /** `null` sale como celda vacía; un número, sin formato de moneda. */
  rows: Array<Array<string | number | null>>;
};

const BOM = "﻿";

/** RFC 4180: se cita si hay coma, comilla o salto; la comilla se duplica. */
function escapeCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") {
    // `toString` y no `toLocaleString`: la coma decimal de es-BO rompería el
    // separador de columnas, y el punto es lo que toda hoja de cálculo suma.
    return Number.isFinite(value) ? String(value) : "";
  }

  const needsQuotes = /[",\r\n]/.test(value);
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
}

function line(cells: Array<string | number | null>): string {
  return cells.map(escapeCell).join(",");
}

/**
 * El archivo completo: contexto, línea en blanco, tabla.
 *
 * El contexto va **dentro del archivo** y no solo en su nombre porque un
 * archivo suelto en el escritorio de alguien tiene que poder explicarse solo:
 * sin el periodo, una tabla de cifras no significa nada, y sin la leyenda del
 * reparto significa algo distinto de lo que parece.
 */
export function toCsv(context: CsvContext, table: CsvTable): string {
  const rows: string[] = [
    line([context.title]),
    line(["Periodo", context.period]),
    line(["Línea", context.line]),
  ];

  if (context.legend) rows.push(line(["Reparto", context.legend]));

  rows.push("");
  rows.push(line(table.headers));
  for (const row of table.rows) rows.push(line(row));

  return BOM + rows.join("\r\n") + "\r\n";
}

/** `informe-rentabilidad-2026-03-01_2026-03-31.csv` */
export function csvFilename(
  reportId: string,
  period: { from: string; to: string },
): string {
  return `informe-${reportId}-${period.from}_${period.to}.csv`;
}
