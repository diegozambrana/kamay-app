"use client";

import { create } from "zustand";

import {
  addLine,
  cartTotal,
  cartUnits,
  clear,
  removeLine,
  type CartLine,
  type SellableProduct,
} from "@/lib/fair/cart";

/**
 * El carrito del modo feria. Efímero a propósito: se vacía en cada venta y no
 * sobrevive a nada (design.md, decisión 8).
 *
 * No se persiste ni se guarda como borrador en la base: sería una escritura
 * por cada toque, en el peor sitio posible para escribir. Lo que sí sobrevive
 * es la **sesión de feria** —línea y canal—, y esa vive en el snapshot.
 *
 * Nada derivado se almacena (convención nº 4): `total` y `units` se calculan
 * al leer, desde las funciones puras de `lib/fair/cart.ts`.
 */

type CartState = {
  lines: CartLine[];
  add: (product: SellableProduct, newId: string) => void;
  remove: (lineId: string) => void;
  empty: () => void;
};

export const useCartStore = create<CartState>()((set) => ({
  lines: [],
  add: (product, newId) =>
    set((state) => ({ lines: addLine(state.lines, product, newId) })),
  remove: (lineId) => set((state) => ({ lines: removeLine(state.lines, lineId) })),
  empty: () => set({ lines: clear() }),
}));

/** El total vigente del carrito. Derivado en la lectura, nunca almacenado. */
export function useCartTotal(): number {
  return cartTotal(useCartStore((state) => state.lines));
}

/** Las unidades del carrito: lo que se cuenta en voz alta al entregar. */
export function useCartUnits(): number {
  return cartUnits(useCartStore((state) => state.lines));
}
