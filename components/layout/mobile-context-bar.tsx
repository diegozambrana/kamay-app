"use client";

import { LineSelector } from "@/features/business-lines/line-selector";
import { SyncIndicator } from "@/features/sync/sync-indicator";
import { useOrganizationStore } from "@/stores/organization-store";

/**
 * Tira de contexto para móvil.
 *
 * Hasta ahora el selector de línea vivía solo en la barra superior, que es
 * `md:flex`: en móvil sencillamente no existía, y la línea activa solo podía
 * cambiarse desde un escritorio. Como la barra inferior es para navegar
 * —no para llevar contexto—, el selector se queda aquí.
 *
 * Su `data-testid` es propio a propósito: `top-bar` está afirmado como
 * *oculto* en móvil, y reutilizarlo rompería esa garantía.
 *
 * Aquí vive también el indicador de registros por sincronizar. No en la barra
 * inferior: esa es para navegar, sus entradas se reparten el ancho a partes
 * iguales y un sexto elemento que aparece y desaparece movería la navegación
 * bajo el pulgar de quien está registrando.
 */
export function MobileContextBar() {
  const organization = useOrganizationStore((state) => state.organization);

  return (
    <div
      data-testid="mobile-context-bar"
      className="sticky top-0 z-40 flex h-12 items-center gap-3 border-b bg-background px-4 md:hidden"
    >
      <LineSelector testId="line-selector-mobile" />

      {organization && (
        <span className="truncate text-sm text-muted-foreground">
          {organization.name}
        </span>
      )}

      <div className="ml-auto">
        <SyncIndicator />
      </div>
    </div>
  );
}
