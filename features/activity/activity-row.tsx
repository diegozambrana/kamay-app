"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DiffRow, EventDetail } from "@/lib/activity/diff";
import { cn } from "@/lib/utils";

import { UnarchiveFromEvent } from "./unarchive-from-event";

/** Un evento ya resuelto y redactado: la fila no consulta ni redacta nada. */
export type ActivityRowItem = {
  id: number;
  /** La frase de `describeEvent()`. La misma que el panel y los historiales. */
  sentence: string;
  /** Iniciales del autor, o `null` si no hay persona detrás. */
  initials: string | null;
  author: string;
  /** `HH:MM` en la zona de la organización. */
  time: string;
  occurredAt: string;
  /** El rótulo del registro: «PEDIDO · #142». `null` si su tabla no da uno. */
  recordLabel: string | null;
  recordKind: string;
  lineName: string | null;
  lineColor: string | null;
  /** 'mobile' | 'desktop' | 'external', o `null` si el evento no lo registró. */
  origin: string | null;
  href: string | null;
  detail: EventDetail;
  /** Para decidir si el evento ofrece desarchivar: acción, tabla y registro. */
  action: string;
  tableName: string;
  recordId: string;
};

const ORIGIN_LABELS: Record<string, string> = {
  mobile: "móvil",
  desktop: "escritorio",
  external: "externo",
};

/**
 * Una fila de V23: la frase, su contexto y —al desplegar— el antes y el después.
 *
 * El detalle llega ya construido por `lib/activity/diff.ts`: esta pieza decide
 * cómo se ve, no qué dice. Que la frase sea la misma que la del panel y la de
 * los cinco historiales de detalle no es disciplina, es que sale de la misma
 * función.
 */
export function ActivityRow({ item }: { item: ActivityRowItem }) {
  const [open, setOpen] = useState(false);
  const expandable = item.detail.kind === "purged" || item.detail.rows.length > 0;

  return (
    <li
      className="border-border/60 border-b last:border-0"
      data-testid="activity-row"
      data-action-id={item.id}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
        <time
          dateTime={item.occurredAt}
          className="text-muted-foreground w-12 shrink-0 text-xs tabular-nums"
        >
          {item.time}
        </time>

        {item.initials && (
          <span
            aria-hidden
            className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-medium"
          >
            {item.initials}
          </span>
        )}

        <span className="min-w-0 flex-1 text-sm">
          {item.href ? (
            <Link href={item.href} className="underline-offset-4 hover:underline">
              {item.sentence}
            </Link>
          ) : (
            item.sentence
          )}
        </span>

        {item.lineName && (
          <Badge
            variant="outline"
            className="shrink-0"
            data-testid="activity-line"
            style={
              item.lineColor
                ? { borderColor: item.lineColor, color: item.lineColor }
                : undefined
            }
          >
            {item.lineName}
          </Badge>
        )}

        {/* Un evento anterior a KAM-22 no tiene origen y la fila lo omite:
            inventar «escritorio» sería escribir historia falsa en la única
            pantalla cuyo trabajo es no hacerlo. */}
        {item.origin && (
          <span
            className="text-muted-foreground shrink-0 text-xs"
            data-testid="activity-origin"
          >
            {ORIGIN_LABELS[item.origin] ?? item.origin}
          </span>
        )}

        {item.recordLabel && (
          <span className="text-muted-foreground shrink-0 text-xs uppercase tracking-wide">
            {item.recordKind} · {item.recordLabel}
          </span>
        )}

        {expandable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            data-testid="activity-expand"
          >
            {open ? "Ocultar" : "Ver cambio"}
          </Button>
        )}

        <UnarchiveFromEvent
          action={item.action}
          tableName={item.tableName}
          recordId={item.recordId}
          recordLabel={item.recordLabel}
        />
      </div>

      {open && (
        <div className="pb-4" data-testid="activity-detail">
          <Detail detail={item.detail} />
        </div>
      )}
    </li>
  );
}

function Detail({ detail }: { detail: EventDetail }) {
  // Un detalle soltado por la retención se declara. No es un error ni una
  // tabla vacía: el evento ocurrió, y lo que ya no está es su detalle.
  if (detail.kind === "purged") {
    return (
      <p className="text-muted-foreground text-sm" data-testid="activity-purged">
        El detalle de este cambio ya no está disponible: la política de
        retención lo liberó. El evento se conserva.
      </p>
    );
  }

  if (detail.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Este evento no registró campos que mostrar.
      </p>
    );
  }

  return (
    <div className={cn("overflow-x-auto")}>
      <p className="text-muted-foreground mb-2 text-xs">
        Solo se muestran los campos que cambiaron.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campo</TableHead>
            <TableHead>Antes</TableHead>
            <TableHead>Después</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detail.rows.map((row: DiffRow) => (
            <TableRow key={row.label} data-testid="activity-diff-row">
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.before}
              </TableCell>
              <TableCell>{row.after}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
