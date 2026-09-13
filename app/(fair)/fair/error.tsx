"use client";

import { SectionError, type SectionErrorProps } from "@/components/shared/section-error";
import { ExitFairMode } from "@/features/fair/exit-fair-mode";

/**
 * El error del modo feria conserva la única salida que el modo permite
 * (criterio 1 de KAM-12): con solo «Reintentar», quien vende quedaría
 * atrapado en una pantalla que no carga. Lo que ya se vendió sin conexión
 * sigue en la cola del dispositivo; este fallo no lo toca.
 */
export default function FairError(props: SectionErrorProps) {
  return (
    <main className="flex min-h-dvh flex-col gap-6 p-4">
      <div>
        <ExitFairMode />
      </div>
      <SectionError boundary="Modo feria" {...props} />
    </main>
  );
}
