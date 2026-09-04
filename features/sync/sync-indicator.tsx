"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { discardEntry, retryEntry } from "@/lib/offline";
import { cn } from "@/lib/utils";
import { useSyncStore } from "@/stores/sync-store";

import { SyncTray } from "./sync-tray";

/**
 * El indicador persistente de registros por sincronizar.
 *
 * Persistente y **no bloqueante** (mapa de navegación §12): informa, no
 * interrumpe. A cero desaparece —un indicador que siempre está deja de
 * mirarse—, y lo que falló se distingue de lo que simplemente espera, porque
 * una cosa se resuelve sola y la otra pide una decisión.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const counts = useSyncStore((state) => state.counts);
  const items = useSyncStore((state) => state.items);
  const [open, setOpen] = useState(false);

  if (counts.total === 0) return null;

  const hasFailures = counts.failed > 0 || counts.held > 0;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-testid="sync-indicator"
        aria-label={`${counts.total} registros por sincronizar`}
        onClick={() => setOpen(true)}
        className={cn("gap-1.5", hasFailures && "text-destructive", className)}
      >
        {hasFailures ? (
          <AlertTriangle className="size-4" aria-hidden />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
        <span data-testid="sync-count" className="tabular-nums">
          {counts.total}
        </span>
      </Button>

      <SyncTray
        open={open}
        onOpenChange={setOpen}
        items={items}
        onRetry={(seq) => void retryEntry(seq)}
        onDiscard={(seq) => void discardEntry(seq)}
      />
    </>
  );
}
