/**
 * El ajuste por conteo (design D6).
 *
 * La diferencia se calcula **en el dispositivo y en el momento del conteo**, y
 * lo que se guarda es esa diferencia, no la cantidad contada. Importa
 * precisamente cuando el registro llega tarde:
 *
 *   Un conteo de 60 hecho a las 15:40, sincronizado a las 18:00, con un
 *   consumo de 4 registrado por otra persona a las 16:00.
 *
 *   Guardando «pon el saldo en 60» → el consumo intermedio desaparece.
 *   Guardando «−5»                 → quedan los dos hechos, cada uno con su
 *                                    hora, y el saldo final es 56.
 *
 * Recalcular la diferencia en el servidor contra el saldo del momento de
 * llegada reescribiría en silencio lo que la persona contó, que es lo
 * contrario de lo que un ajuste por conteo significa.
 */

/** `numeric(14,3)`: tres decimales, ni uno más. */
const SCALE = 1000;

/** Redondea a la escala de la columna. `57.1 - 57` no es `0.1` en coma flotante. */
function toScale(value: number): number {
  return Math.round(value * SCALE) / SCALE;
}

export type CountOutcome =
  /** Hay diferencia: se guarda un ajuste por esta cantidad, con signo. */
  | { status: "adjustment"; difference: number }
  /**
   * El conteo coincide con el saldo. No es un error: es la respuesta correcta
   * y frecuente. La base rechazaría un movimiento de cantidad cero, así que
   * esto se detecta antes de intentar guardarlo.
   */
  | { status: "unchanged" };

/**
 * Qué hacer con un conteo físico.
 *
 * `counted` es lo que hay en el estante; `balance`, lo que dice el sistema.
 */
export function countAdjustment(counted: number, balance: number): CountOutcome {
  const difference = toScale(counted - balance);
  if (difference === 0) return { status: "unchanged" };
  return { status: "adjustment", difference };
}
