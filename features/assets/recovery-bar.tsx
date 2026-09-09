import { CheckCircle2Icon } from "lucide-react";

import { recoveryOf } from "@/lib/assets/recovery";
import { cn } from "@/lib/utils";

/**
 * La barra de recuperación de inversión.
 *
 * El porcentaje no se calcula aquí: llega de `recoveryOf`, que es el único
 * lugar donde vive la fórmula (criterio 6 del backlog, design D5). Este
 * componente pinta lo que esa función dice, y nada más.
 *
 * La barra es decorativa (`aria-hidden`) y el porcentaje se escribe al lado:
 * un lector de pantalla lee números, no anchos —el mismo criterio que el
 * comparativo del panel—.
 */
export function RecoveryBar({
  totalCost,
  marginSince,
  label,
}: {
  totalCost: number;
  marginSince: number;
  /** Nombre del activo, para que la barra se lea sola fuera de su tarjeta. */
  label: string;
}) {
  const { percent, recovered } = recoveryOf({ totalCost, marginSince });

  return (
    <div className="flex flex-col gap-1" data-testid="recovery-bar" data-percent={percent}>
      <div
        aria-hidden
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            recovered ? "bg-emerald-600 dark:bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="tabular-nums font-medium text-foreground">{percent} %</span>
        <span className="sr-only">de la inversión en {label} recuperada</span>
        {/*
          Sobrio a propósito (criterio 3 del backlog): una marca discreta y la
          barra llena. Nada de felicitaciones — la tarjeta no se destaca por
          encima de las demás, solo dice lo que pasó.
        */}
        {recovered && (
          <span
            className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
            data-testid="recovered-mark"
          >
            <CheckCircle2Icon aria-hidden className="size-3.5" />
            Recuperado
          </span>
        )}
      </p>
    </div>
  );
}
