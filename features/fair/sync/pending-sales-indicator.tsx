"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SyncTray } from "@/features/sync/sync-tray";
import { DIRECT_SALE_CREATE } from "@/features/sync/operations";
import { discardEntry, retryEntry } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/stores/sync-store";

/**
 * Cuántas **ventas** faltan por sincronizar (design.md, decisión 13).
 *
 * El indicador general de KAM-11 vive en la cabecera y en la barra de contexto
 * móvil, y el modo feria no monta ninguna de las dos (decisión 7). Este es el
 * suyo, sobre las mismas fuentes: `useSyncStore` para el conteo reactivo y
 * `retryEntry` / `discardEntry` para las acciones.
 *
 * Filtra por operación a propósito. Quien atiende un puesto necesita saber
 * cuántas ventas suyas faltan, no cuántos registros de toda la organización:
 * un pedido encolado ayer desde el taller no es asunto suyo ahora, y sumarlo
 * convierte un número que debe tranquilizar en uno que confunde.
 */
export function PendingSalesIndicator({ className }: { className?: string }) {
  const items = useSyncStore((state) => state.items);
  const [open, setOpen] = useState(false);

  const sales = items.filter((item) => item.entry.operation === DIRECT_SALE_CREATE);

  // A cero desaparece: un indicador que siempre está deja de mirarse, y aquí
  // el espacio es de los controles de venta.
  if (sales.length === 0) return null;

  const failed = sales.filter((item) => item.entry.state === "failed").length;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="fair-pending-sales"
        aria-label={`${sales.length} ventas por sincronizar`}
        onClick={() => setOpen(true)}
        className={cn("gap-1.5", failed > 0 && "text-destructive", className)}
      >
        {failed > 0 ? (
          <AlertTriangle className="size-4" aria-hidden />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
        <span data-testid="fair-pending-count" className="tabular-nums">
          {sales.length}
        </span>
      </Button>

      <SyncTray
        open={open}
        onOpenChange={setOpen}
        items={sales}
        onRetry={(seq) => void retryEntry(seq)}
        onDiscard={(seq) => void discardEntry(seq)}
      />
    </>
  );
}
