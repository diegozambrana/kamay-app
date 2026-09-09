/**
 * La fórmula de margen de los informes, y el único lugar donde vive
 * (KAM-20, design D6 y §5.2 de las tareas).
 *
 * No se solapa con `lib/assets/recovery.ts`: aquélla convierte un margen ya
 * calculado en una proporción recuperada; ésta es la que produce el margen.
 * El margen **de caja por línea** —cobrado menos pagado— lo calcula
 * `cash_flow_by_line_range` en la base, donde es una resta de dos agregados;
 * lo que se resuelve aquí es el margen **de un pedido o de un producto**, que
 * tiene un borde que la base no debe decidir: qué pasa cuando no hubo ingreso.
 */

export type MarginInput = {
  revenue: number;
  cost: number;
};

export type Margin = {
  /** Ingresos menos costo. Puede ser negativo, y se muestra tal cual. */
  amount: number;
  /**
   * El margen como porcentaje de los ingresos, o `null` cuando no hay
   * ingresos contra los que medirlo.
   *
   * `null` y no cero: un pedido que no ingresó nada y costó 80 no tiene un
   * margen del 0 %, tiene un margen del que no se puede hablar en porcentaje.
   * Devolver cero lo haría indistinguible de un pedido que ingresó 100 y
   * costó 100, que es un hecho completamente distinto.
   */
  percent: number | null;
};

export function marginOf({ revenue, cost }: MarginInput): Margin {
  const amount = revenue - cost;

  if (revenue === 0) return { amount, percent: null };

  return { amount, percent: (amount / revenue) * 100 };
}

/**
 * ¿Se puede confiar en el margen de esta fila?
 *
 * Un pedido sin ningún egreso asignado tiene costo cero y, por tanto, un
 * margen del 100 %. Es aritméticamente cierto y comercialmente falso: no
 * significa que no costara nada, significa que no se registró lo que costó
 * (design D6). La pantalla usa esto para marcar la fila y para filtrar por
 * ella, que es la función principal del informe mientras no existan las
 * fichas de producto.
 */
export function isCostCaptured(hasCost: boolean, cost: number): boolean {
  return hasCost && cost > 0;
}
