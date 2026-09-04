"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * ¿Hay conexión? (KAM-11, design.md decisión 4).
 *
 * `navigator.onLine` miente: en una WiFi sin salida a internet devuelve `true`
 * y el puesto de feria se queda registrando contra un servidor inalcanzable.
 * Por eso la señal combina lo que dice el navegador con la evidencia del
 * último envío: un envío que acaba de fallar por red pesa más que cualquier
 * bandera del sistema operativo.
 */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);

  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** En el servidor no hay navegador: se asume conexión y el cliente corrige. */
const assumeOnline = () => true;

export function useOnlineStatus() {
  const browserOnline = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    assumeOnline,
  );

  const [lastSendFailed, setLastSendFailed] = useState(false);

  useEffect(() => {
    // Volver a tener interfaz de red es una razón para volver a intentarlo,
    // no una prueba de que el servidor esté al alcance: se borra la sospecha
    // y el primer envío decide.
    const clear = () => setLastSendFailed(false);

    window.addEventListener("online", clear);
    return () => window.removeEventListener("online", clear);
  }, []);

  const reportSendResult = useCallback((succeeded: boolean) => {
    setLastSendFailed(!succeeded);
  }, []);

  return {
    isOnline: browserOnline && !lastSendFailed,
    /** Lo que dice el navegador, sin corregir. Para decidir si vale la pena intentar. */
    browserOnline,
    reportSendResult,
  };
}
