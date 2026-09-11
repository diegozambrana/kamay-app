"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { EventDetail } from "@/lib/activity/diff";
import { formatDateTime } from "@/lib/format/datetime";
import type { RecordHistory } from "@/services/activity/record-history";

/**
 * El bloque de historial de una pantalla de detalle.
 *
 * Vive en `components/` y no en una rebanada porque lo comparten cinco:
 * pedidos, catálogo, egresos, tareas y activos. Una importación cruzada entre
 * rebanadas rompería la separación por dominio; `components/` es la capa de
 * presentación compartida donde ARCHITECTURE.md pone los widgets de dominio
 * (design D11).
 *
 * No consulta nada: recibe los eventos ya redactados por
 * `loadRecordHistory()`, igual que `RecentActivity` en el panel. Y redacta con
 * la misma función que la bitácora general, para que un mismo evento no se lea
 * de dos maneras según desde dónde se mire.
 */
export function RecordHistory({
  history,
  timezone,
  emptyMessage = "No hay historial que mostrar.",
}: {
  history: RecordHistory;
  timezone: string;
  emptyMessage?: string;
}) {
  if (history.items.length === 0) {
    // Para quien no puede leer la bitácora esto llega vacío por RLS: se rinde
    // el mensaje de lista sin contenido, nunca un error.
    return (
      <p className="text-muted-foreground text-sm" data-testid="empty-history">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-1 text-sm">
        {history.items.map((item) => (
          <HistoryEntry key={item.id} item={item} timezone={timezone} />
        ))}
      </ol>

      <Link
        href={history.activityHref}
        className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        data-testid="activity-link"
      >
        Ver todo en la bitácora
      </Link>
    </div>
  );
}

function HistoryEntry({
  item,
  timezone,
}: {
  item: RecordHistory["items"][number];
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const expandable =
    item.detail.kind === "purged" || item.detail.rows.length > 0;

  return (
    <li data-testid="history-entry" data-action={item.action}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span>{item.sentence}</span>
        <time
          dateTime={item.occurredAt}
          className="text-muted-foreground text-xs"
        >
          {formatDateTime(item.occurredAt, timezone)}
        </time>
        {expandable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Ocultar" : "Ver cambio"}
          </Button>
        )}
      </div>

      {open && <Detail detail={item.detail} />}
    </li>
  );
}

function Detail({ detail }: { detail: EventDetail }) {
  if (detail.kind === "purged") {
    return (
      <p className="text-muted-foreground py-1 text-xs">
        El detalle de este cambio ya no está disponible: la política de
        retención lo liberó.
      </p>
    );
  }

  return (
    <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 py-1 text-xs">
      {detail.rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="font-medium">{row.label}</dt>
          <dd>
            {row.before} → {row.after}
          </dd>
        </div>
      ))}
    </dl>
  );
}
