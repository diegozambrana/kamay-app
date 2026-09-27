"use client";

import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * La barra inferior fija: unidades, total y *Ver carrito*, que abre el panel
 * con el detalle y el cobro (`CartDrawer`).
 *
 * Está siempre, no aparece al llenar el carrito: una barra que entra y sale
 * mueve el resto de la pantalla, y lo que se mueve se toca por error. Tampoco
 * lista las líneas: esa lista le quitaba alto a la cuadrícula justo donde se
 * toca, y el detalle ya vive en el panel.
 */
export function CartBar({
  units,
  total,
  onOpen,
}: {
  units: number;
  total: number;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t bg-background p-3">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">
          {units} {units === 1 ? "unidad" : "unidades"}
        </p>
        <p data-testid="cart-total" className="text-2xl font-semibold tabular-nums">
          {total}
        </p>
      </div>
      <Button
        type="button"
        size="lg"
        data-testid="fair-view-cart"
        // Con el carrito vacío no hay nada que ver. Deshabilitado y no oculto:
        // un botón que desaparece mueve la barra bajo el pulgar.
        disabled={units === 0}
        onClick={onOpen}
        className="h-14 min-w-36 text-lg"
      >
        <ShoppingCart aria-hidden />
        Ver carrito
      </Button>
    </div>
  );
}
