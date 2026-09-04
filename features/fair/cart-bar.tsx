"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CartLine } from "@/lib/fair/cart";

/**
 * La barra inferior fija: unidades, total y *Cobrar*.
 *
 * Está siempre, no aparece al llenar el carrito: una barra que entra y sale
 * mueve el resto de la pantalla, y lo que se mueve se toca por error.
 */
export function CartBar({
  lines,
  units,
  total,
  onRemove,
  onCheckout,
}: {
  lines: readonly CartLine[];
  units: number;
  total: number;
  onRemove: (lineId: string) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="border-t bg-background">
      {lines.length > 0 ? (
        <ul className="max-h-32 overflow-y-auto px-3 py-2">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-2 py-1 text-sm"
            >
              <span className="truncate">
                {line.quantity} × {line.name}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{line.quantity * line.unitPrice}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${line.name}`}
                  onClick={() => onRemove(line.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center gap-3 p-3">
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
          data-testid="fair-checkout"
          // Con el carrito vacío no hay nada que cobrar. Deshabilitado y no
          // oculto: un botón que desaparece mueve la barra bajo el pulgar.
          disabled={lines.length === 0}
          onClick={onCheckout}
          className="h-14 min-w-32 text-lg"
        >
          Cobrar
        </Button>
      </div>
    </div>
  );
}
