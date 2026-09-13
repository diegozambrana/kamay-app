"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/monitoring/report-error";

import { ErrorState } from "./error-state";

export type SectionErrorProps = {
  error: Error & { digest?: string };
  /** Vuelve a pedir y a rendir el segmento (Next 16.3). */
  retry: () => void;
};

/**
 * El estado de error sin contenedor propio, para los segmentos que ya viven
 * dentro de uno: las secciones de Configuración, cuyo layout pinta el
 * encabezado y las pestañas, y el modo feria, que no tiene cascarón.
 *
 * Reporta el error y no lo pinta (`ErrorState` ni siquiera lo recibe).
 */
export function SectionError({
  boundary,
  error,
  retry,
}: SectionErrorProps & { boundary: string }) {
  useEffect(() => {
    reportError(error, { boundary });
  }, [error, boundary]);

  return <ErrorState onRetry={retry} />;
}
