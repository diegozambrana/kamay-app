import * as React from "react";

/** Mismo corte que `md:` en Tailwind: por debajo de 768px es móvil. */
const MOBILE_BREAKPOINT = 768;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * ¿El viewport es móvil?
 *
 * `matchMedia` es un almacén externo al árbol de React, así que se lee con
 * `useSyncExternalStore` y no con estado + efecto: el valor no se queda a
 * medias entre el primer render y el efecto, y no hay `setState` dentro de un
 * efecto (que es lo que la regla `react-hooks/set-state-in-effect` prohíbe).
 *
 * En el servidor devuelve `false`: el marcado que se hidrata es el de
 * escritorio, y el cliente corrige en el primer commit si hace falta.
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
