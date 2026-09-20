/**
 * KAM-27 · La curva de margen de la calculadora de impresión 3D (spec
 * `print-cost-3d` → *El margen unitario varía con el costo según una curva de
 * anclas* y *Una curva de margen nunca hace bajar el precio al subir el
 * costo*; design D9).
 *
 * Una pieza que cuesta 5 aguanta un margen de 250 %; una que cuesta 70, no. La
 * curva son **anclas** «costo → margen» unidas por rectas: fuera del rango se
 * sujeta al extremo, dentro se interpola.
 *
 * Por qué no tramos escalonados («hasta 10 → 250 %, hasta 50 → 200 %»): en
 * cada frontera el precio **cae** al subir el costo (9,90 × 2,5 = 24,75 pero
 * 10,10 × 2,0 = 20,20). Con rectas eso se puede evitar — y `validateCurve`
 * comprueba que de verdad se evitó.
 */

/** `margin` es un multiplicador: 2,5 = 250 %. */
export type MarginAnchor = { cost: number; margin: number };

/** El margen que corresponde a un costo. La curva se supone ya validada. */
export function marginAt(curve: readonly MarginAnchor[], cost: number): number {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (cost <= first.cost) return first.margin;
  if (cost >= last.cost) return last.margin;

  for (let i = 1; i < curve.length; i += 1) {
    const from = curve[i - 1];
    const to = curve[i];
    if (cost <= to.cost) {
      const progress = (cost - from.cost) / (to.cost - from.cost);
      return from.margin + (to.margin - from.margin) * progress;
    }
  }
  // Inalcanzable: `cost >= last.cost` ya volvió arriba.
  return last.margin;
}

export type CurveProblem = {
  reason: "empty" | "cost" | "order" | "margin" | "rising" | "price-drops";
  /** Índice del ancla donde se nota el problema, para pintar el error ahí. */
  index: number;
  message: string;
};

const percent = (margin: number) => `${Math.round(margin * 100)} %`;

/**
 * `null` si la curva sirve; si no, el primer problema encontrado.
 *
 * **La comprobación de monotonía es exacta, no un muestreo.** En un segmento
 * de pendiente `s ≤ 0`, el precio `p(c) = c · m(c)` es una parábola cóncava:
 * su derivada `m(c) + c · s` decrece con `c`, así que es mínima en el extremo
 * derecho. Si ahí es ≥ 0, el precio no baja en ningún punto del segmento.
 * Fuera del rango el margen es constante y el precio crece con el costo.
 */
export function validateCurve(curve: readonly MarginAnchor[]): CurveProblem | null {
  if (curve.length === 0) {
    return { reason: "empty", index: 0, message: "La curva necesita al menos un ancla." };
  }

  for (let i = 0; i < curve.length; i += 1) {
    const anchor = curve[i];
    if (!(anchor.cost > 0)) {
      return { reason: "cost", index: i, message: "El costo de un ancla tiene que ser mayor que cero." };
    }
    if (!(anchor.margin >= 1)) {
      return {
        reason: "margin",
        index: i,
        message: "Un margen por debajo de 100 % vende por debajo del costo.",
      };
    }
    if (i === 0) continue;

    const previous = curve[i - 1];
    if (!(anchor.cost > previous.cost)) {
      return {
        reason: "order",
        index: i,
        message: "Las anclas van ordenadas por costo, sin repetir ninguno.",
      };
    }
    if (anchor.margin > previous.margin) {
      return {
        reason: "rising",
        index: i,
        message: `El margen no puede subir con el costo: pasa de ${percent(previous.margin)} a ${percent(anchor.margin)}.`,
      };
    }

    const slope = (anchor.margin - previous.margin) / (anchor.cost - previous.cost);
    // Tolerancia mínima: el caso límite exacto (derivada 0) es válido y no
    // debe rechazarse por el último bit de una división.
    if (anchor.margin + anchor.cost * slope < -1e-9) {
      return {
        reason: "price-drops",
        index: i,
        message:
          `Entre ${previous.cost} y ${anchor.cost} el precio bajaría al subir el costo: ` +
          `el margen cae demasiado rápido de ${percent(previous.margin)} a ${percent(anchor.margin)}.`,
      };
    }
  }

  return null;
}
