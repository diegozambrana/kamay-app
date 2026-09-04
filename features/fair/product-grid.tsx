"use client";

import { cn } from "@/lib/utils";
import type { FairProduct } from "@/services/fair/fair-sale-service";

/**
 * La cuadrícula de V6: lo primero que se ve al abrir el puesto.
 *
 * Un toque agrega al carrito. **Sin diálogo, sin confirmación, sin paso
 * intermedio**: son quince segundos por venta y cada paso extra los gasta.
 *
 * Objetivos grandes y separados: se toca de pie, con una mano, con gente
 * esperando. Sin desplazamiento horizontal a 390 px.
 */
export function ProductGrid({
  products,
  onPick,
  ageLabel,
}: {
  products: readonly FairProduct[];
  onPick: (product: FairProduct) => void;
  /** De cuándo es el catálogo mostrado. Siempre a la vista (decisión 12). */
  ageLabel: string | null;
}) {
  if (products.length === 0) {
    // `flex-1` también aquí: sin él la cuadrícula vacía colapsa y la barra de
    // cobro sube al centro de la pantalla, justo donde está el pulgar.
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Esta línea no tiene productos con precio de venta. Ponles precio en el
          catálogo para poder venderlos aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {ageLabel ? (
        <p
          data-testid="snapshot-age"
          className="px-3 pt-2 text-center text-xs text-muted-foreground"
        >
          {ageLabel}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              data-testid="fair-product"
              onClick={() => onPick(product)}
              className={cn(
                // `min-h-24`: objetivo táctil holgado para el pulgar.
                "flex min-h-24 w-full flex-col justify-between rounded-lg border p-3 text-left",
                "active:scale-[0.98] transition-transform",
              )}
            >
              <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
              <span className="text-lg font-semibold tabular-nums">
                {product.salePrice}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
