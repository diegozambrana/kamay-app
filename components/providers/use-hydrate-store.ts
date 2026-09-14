"use client";

import { type DependencyList, useLayoutEffect, useRef } from "react";

/**
 * ¿Ya hay un cascarón montado en esta pestaña? Hasta la primera vez, nadie
 * está suscrito a los stores.
 */
let shellMounted = false;

/**
 * Hidrata un store global con lo que el servidor ya resolvió (KAM-26).
 *
 * En la **primera carga** se escribe durante el render, antes que los hijos:
 * ninguna pantalla debe rendirse con un contexto distinto del del servidor, y
 * todavía no hay nadie suscrito a quien avisar.
 *
 * En una **navegación entre grupos de rutas** —de `(platform)` a `(app)`, o
 * de `(app)` al perfil de `(account)`— Next monta el layout nuevo mientras el
 * anterior sigue en pantalla, suscrito a los mismos stores. Escribir entonces
 * durante el render actualiza componentes de otro árbol en medio del render,
 * que React prohíbe («Cannot update a component while rendering a different
 * component»). En ese caso lo escribe un efecto de diseño, que corre antes de
 * pintar: la pantalla nueva no llega a verse con los valores viejos.
 */
export function useHydrateStore(apply: () => void, deps: DependencyList) {
  const hydrated = useRef<true | null>(null);
  if (hydrated.current == null) {
    hydrated.current = true;
    if (!shellMounted) apply();
  }

  useLayoutEffect(() => {
    shellMounted = true;
    apply();
    // `apply` cambia en cada render; lo que decide son sus datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
