"use client";

import { SectionError, type SectionErrorProps } from "@/components/shared/section-error";

/**
 * El límite de los layouts de grupo: si falla la carga del propio cascarón
 * —la sesión, las membresías, las líneas—, no hay encabezado de sección que
 * conservar. Se muestra el mismo estado de error, centrado, dentro del layout
 * raíz: con el tema y los estilos, a diferencia de `global-error.tsx`.
 */
export default function AppError(props: SectionErrorProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SectionError boundary="Aplicación" {...props} />
      </div>
    </main>
  );
}
