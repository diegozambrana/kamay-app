/**
 * El orden de la cuadrícula del modo feria (KAM-12, design decisión 4).
 *
 * Lo más vendido primero; lo que nunca se vendió, después y por nombre.
 *
 * El orden se calcula aquí y no en la consulta porque la vista
 * `best_selling_products` solo conoce lo que YA se vendió: un producto recién
 * creado no tiene fila en ella, y ordenar solo por la vista lo dejaría
 * invisible — que es justo el que más falta hace mostrar en un puesto.
 */

/** Un producto de la cuadrícula, con sus ventas recientes si las tiene. */
export type GridProduct = {
  id: string;
  name: string;
  salePrice: number;
  /** Cantidad vendida en la ventana de 90 días. `0` si nunca se vendió. */
  quantitySold: number;
};

/**
 * Ordena por ventas descendentes y, a igualdad —incluido el cero—, por nombre.
 *
 * El desempate por nombre no es decorativo: sin él, dos productos con las
 * mismas ventas cambiarían de sitio entre recargas, y una cuadrícula que se
 * reordena sola es una cuadrícula en la que se toca el producto equivocado.
 */
export function orderGrid(products: readonly GridProduct[]): GridProduct[] {
  return [...products].sort((a, b) => {
    const soldA = Number.isFinite(a.quantitySold) ? a.quantitySold : 0;
    const soldB = Number.isFinite(b.quantitySold) ? b.quantitySold : 0;

    if (soldA !== soldB) return soldB - soldA;
    return a.name.localeCompare(b.name, "es");
  });
}
