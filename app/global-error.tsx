"use client";

import "./globals.css";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { reportError } from "@/lib/monitoring/report-error";

/**
 * El último límite de error: cuando falla el propio layout raíz.
 *
 * Reemplaza todo el documento —Next lo exige con su propio `<html>` y
 * `<body>`— y por eso no hereda el tema ni los proveedores. Muestra el mismo
 * estado de error que cualquier sección, sin ningún detalle técnico, y
 * reintentar vuelve a pedir la aplicación sin recargarla (design D1).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "global" });
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-dvh items-center justify-center p-4 antialiased">
        <title>Kamay</title>
        <main className="w-full max-w-md">
          <ErrorState
            title="Kamay no pudo abrirse"
            description="Puede ser la conexión o un fallo momentáneo. Lo que ya registraste está a salvo."
            onRetry={retry}
          />
        </main>
      </body>
    </html>
  );
}
