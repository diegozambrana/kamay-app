/** Como el resto de Kamay: dos decimales, y la moneda en el encabezado, no en cada cifra. */
export function money(value: number): string {
  return value.toFixed(2);
}

/** 1590 → «1590 min»; 90,5 → «90,5 min». */
export function minutesLabel(value: number): string {
  return `${String(Number(value.toFixed(2))).replace(".", ",")} min`;
}

/** 2,125 → «212,5 %»; 2,5 → «250 %». */
export function marginPercent(margin: number): string {
  return `${String(Number((margin * 100).toFixed(1))).replace(".", ",")} %`;
}
