/**
 * El carrito del modo feria (KAM-12).
 *
 * Operaciones puras: el store de Zustand las envuelve, pero el cálculo vive
 * aquí para que se pueda probar sin montar nada. Nada de esto se almacena
 * (convención nº 4): el carrito muere en cada venta y el total se deriva de
 * sus líneas cada vez que se lee.
 */

/** Una línea del carrito. Un producto agregado dos veces es UNA línea con 2. */
export type CartLine = {
  /** `uuid` generado en el cliente: es el `id` que tendrá `order_items`. */
  id: string;
  itemId: string;
  variantId: string | null;
  name: string;
  quantity: number;
  /** El precio del momento, no el que tenga el catálogo cuando se lea. */
  unitPrice: number;
  /**
   * La línea del producto, o `null` si es compartido. Con «Venta rápida con
   * todas las líneas», cada línea del carrito se registra en esta línea —los
   * compartidos, en la de la feria— (`fair-all-lines`, design decisión 3).
   */
  businessLineId: string | null;
};

/** Lo que hace falta saber de un producto para meterlo al carrito. */
export type SellableProduct = {
  id: string;
  variantId?: string | null;
  name: string;
  salePrice: number;
  businessLineId?: string | null;
};

/** Redondeo a centavos: la suma de flotantes no puede mostrar 0.30000000004. */
function cents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Dos líneas son la misma cuando coinciden producto y variante. Es lo que
 * hace que tocar un producto dos veces sume cantidad en vez de abrir una
 * segunda línea idéntica: en un puesto de feria, una lista de seis líneas de
 * "Taza × 1" es imposible de revisar antes de cobrar.
 */
function sameProduct(line: CartLine, product: SellableProduct): boolean {
  return line.itemId === product.id
    && line.variantId === (product.variantId ?? null);
}

/** Una cantidad del carrito: entera y de al menos 1. */
function units(quantity: number): number {
  return Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
}

/**
 * Agregar `quantity` unidades de un producto (1 si no se dice). Si ya estaba,
 * incrementa su cantidad; si no, añade una línea al final. Nunca abre un
 * diálogo ni pide confirmación: es un toque en *Agregar*.
 *
 * `newId` se recibe en vez de generarse aquí para que la función siga siendo
 * pura y la prueba pueda fijar el identificador.
 */
export function addLine(
  lines: readonly CartLine[],
  product: SellableProduct,
  newId: string,
  quantity = 1,
): CartLine[] {
  const added = units(quantity);
  const existing = lines.findIndex((line) => sameProduct(line, product));

  if (existing >= 0) {
    return lines.map((line, index) =>
      index === existing ? { ...line, quantity: line.quantity + added } : line,
    );
  }

  return [
    ...lines,
    {
      id: newId,
      itemId: product.id,
      variantId: product.variantId ?? null,
      name: product.name,
      quantity: added,
      unitPrice: product.salePrice,
      businessLineId: product.businessLineId ?? null,
    },
  ];
}

/**
 * Fijar la cantidad de una línea: los − y + del panel del carrito. No baja de
 * 1: dejar una línea en cero desde el − sería quitarla sin querer, y quitar
 * tiene su propio control.
 */
export function setLineQuantity(
  lines: readonly CartLine[],
  lineId: string,
  quantity: number,
): CartLine[] {
  return lines.map((line) =>
    line.id === lineId ? { ...line, quantity: units(quantity) } : line,
  );
}

/** Quitar una línea entera. */
export function removeLine(lines: readonly CartLine[], lineId: string): CartLine[] {
  return lines.filter((line) => line.id !== lineId);
}

/** Vaciar. Lo que ocurre tras cada venta confirmada. */
export function clear(): CartLine[] {
  return [];
}

/** El total que muestra la barra inferior, y el monto que propone el cobro. */
export function cartTotal(lines: readonly CartLine[]): number {
  return cents(
    lines.reduce((sum, line) => {
      const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
      const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
      return sum + quantity * unitPrice;
    }, 0),
  );
}

/** Unidades en el carrito: lo que se cuenta en voz alta al entregar. */
export function cartUnits(lines: readonly CartLine[]): number {
  return lines.reduce(
    (sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0),
    0,
  );
}
