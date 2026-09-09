"use client";

import { hasAttributableLine } from "@/lib/assets/recovery";
import { lineColorClasses } from "@/lib/business-lines/colors";
import { formatCalendarDate } from "@/lib/format/datetime";
import { cn } from "@/lib/utils";
import type { LineColor } from "@/types";

import { RecoveryBar } from "./recovery-bar";
import type { AssetRowView } from "./assets-screen";

function LineBadge({ name, color }: { name: string; color: LineColor }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", lineColorClasses(color).dot)} />
      {name}
    </span>
  );
}

/**
 * Una tarjeta por activo (V12): qué es, de qué línea, qué costó, cuándo se
 * compró, cuánto lleva de mantenimiento y cuánto se ha pagado sola.
 *
 * Un activo compartido entre líneas no lleva barra: la línea General no genera
 * ingresos por definición, así que su porcentaje sería siempre 0 % y no diría
 * nada. En su lugar se declara en palabras, y el reparto entre líneas queda
 * donde le corresponde, en la regla configurable de V14 (KAM-20).
 */
export function AssetCard({ asset, onOpen }: { asset: AssetRowView; onOpen: () => void }) {
  const attributable = hasAttributableLine(asset);

  return (
    <li>
      <button
        type="button"
        data-testid="asset-card"
        data-item-id={asset.itemId}
        data-archived={asset.archivedAt ? "true" : undefined}
        className={cn(
          "flex w-full flex-col gap-3 rounded-lg border p-4 text-left",
          asset.archivedAt && "opacity-60",
        )}
        onClick={onOpen}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{asset.name}</span>
          <span className="tabular-nums font-medium" data-testid="asset-total-cost">
            {asset.totalCost.toFixed(2)}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Costo</dt>
            <dd className="tabular-nums">{asset.acquisitionCost.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Comprado</dt>
            <dd className="tabular-nums">{formatCalendarDate(asset.acquiredOn)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Mantenimiento</dt>
            <dd className="tabular-nums" data-testid="asset-maintenance">
              {asset.maintenanceCost.toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Línea</dt>
            <dd>
              {attributable ? (
                <LineBadge name={asset.lineName} color={asset.lineColor} />
              ) : (
                "Compartido"
              )}
            </dd>
          </div>
        </dl>

        {attributable ? (
          <RecoveryBar
            totalCost={asset.totalCost}
            marginSince={asset.lineMarginSince}
            label={asset.name}
          />
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="not-attributable">
            Compartido entre líneas: su recuperación no se puede atribuir a una sola
            línea hasta que exista la regla de reparto de los reportes.
          </p>
        )}
      </button>
    </li>
  );
}
