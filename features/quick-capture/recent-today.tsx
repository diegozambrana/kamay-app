"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  mergeRecentCaptures,
  pendingCapturesToday,
  type CaptureKind,
  type RecentCapture,
} from "@/lib/quick-capture/recent";
import { useSyncStore } from "@/stores/sync-store";

const KIND_LABELS: Record<CaptureKind, string> = {
  order: "Pedido",
  "direct-sale": "Venta rápida",
  purchase: "Compra",
  cost: "Gasto",
};

/** La hora del hecho, en la zona de la organización. Sin fecha: es de hoy. */
function timeOf(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("es-BO", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

/**
 * "Registrado hoy": la confirmación de que la captura llegó.
 *
 * Tiene dos orígenes. El servidor los trae ya resueltos; la cola la aporta el
 * cliente, porque vive en este dispositivo. Un registro capturado sin señal
 * aparece igual, marcado como no enviado: si la lista solo leyera del
 * servidor, tomar un pedido en la calle dejaría la pantalla afirmando que hoy
 * no se registró nada — justo la duda que existe para disipar (design D3b).
 *
 * Lo pendiente no ofrece reintentar ni descartar: eso es la bandeja del
 * indicador de sincronización, a un toque más arriba. Dos superficies que
 * resuelven la misma cola acaban contradiciéndose.
 */
export function RecentToday({
  synced,
  today,
  timezone,
  lineNames,
}: {
  /** Lo que el servidor devolvió, ya normalizado. */
  synced: RecentCapture[];
  /** "Hoy" en la zona de la organización, como `YYYY-MM-DD`. */
  today: string;
  timezone: string;
  /** `businessLineId → nombre`, para no volver a consultar por cada fila. */
  lineNames: Record<string, string>;
}) {
  const items = useSyncStore((state) => state.items);
  const rows = mergeRecentCaptures(
    synced,
    pendingCapturesToday(items, today, timezone),
  );

  if (rows.length === 0) {
    return (
      <p data-testid="recent-today-empty" className="text-sm text-muted-foreground">
        Todavía no registraste nada hoy.
      </p>
    );
  }

  return (
    <ul data-testid="recent-today" className="divide-y rounded-lg border">
      {rows.map((row) => {
        const content = (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{row.label}</p>
              <p className="truncate text-xs text-muted-foreground">
                {KIND_LABELS[row.kind]}
                {row.lineId && lineNames[row.lineId]
                  ? ` · ${lineNames[row.lineId]}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {row.pending && (
                <Badge variant="secondary" data-testid="recent-pending">
                  Sin enviar
                </Badge>
              )}
              <span className="text-xs tabular-nums text-muted-foreground">
                {timeOf(row.occurredAt, timezone)}
              </span>
            </div>
          </>
        );

        const className = "flex items-center justify-between gap-3 px-3 py-2.5";

        // Mientras no se haya enviado no hay detalle que abrir: la fila se
        // rinde inerte, no como un enlace roto.
        return row.href ? (
          <li key={row.id}>
            <Link href={row.href} className={className}>
              {content}
            </Link>
          </li>
        ) : (
          <li key={row.id} className={className} data-testid="recent-row-inert">
            {content}
          </li>
        );
      })}
    </ul>
  );
}
