"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";


/** Cuánto se ve el aviso: lo justo para leerlo de reojo. */
export const FAIR_TOAST_MS = 2_500;

/**
 * Un aviso. El `id` distingue dos ventas seguidas con el mismo texto: sin él,
 * la segunda no reiniciaría la cuenta.
 */
export type FairToastMessage = { id: number; text: string };

/**
 * El aviso breve de «venta registrada» (`fair-product-photos-visibility-cart-drawer`,
 * design.md decisión 6).
 *
 * Flota sobre la barra inferior sin tapar la cuadrícula y **sin capturar
 * toques** (`pointer-events-none`): quien ya atiende al siguiente cliente no
 * tiene que cerrarlo ni esperarlo. Desaparece solo.
 *
 * La región `role="status"` está siempre montada: un lector de pantalla solo
 * anuncia los cambios de una región que ya existía.
 */
export function FairToast({ message }: { message: FairToastMessage | null }) {
  const [hidden, setHidden] = useState<number | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setHidden(message.id), FAIR_TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const visible = message !== null && hidden !== message.id;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-24 z-40 flex justify-center"
    >
      {visible ? (
        <p
          data-testid="fair-toast"
          className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
        >
          <CheckCircle2 className="size-4" aria-hidden />
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
