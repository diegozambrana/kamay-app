/**
 * Peso de un archivo tal como lo lee una persona.
 *
 * Se usan múltiplos de 1024 (KB, MB) porque es lo que muestran el escritorio
 * y el propio Supabase Storage: un archivo que el sistema operativo llama de
 * "4,8 MB" no puede aparecer aquí como 5 MB y hacer dudar del límite.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  // Un decimal basta: "4,8 MB" informa; "4,83 MB" solo estorba.
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded.toString().replace(".", ",")} ${units[unit]}`;
}
