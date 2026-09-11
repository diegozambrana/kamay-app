import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeEvent } from "@/lib/activity/describe";
import { formatDateTime } from "@/lib/format/datetime";

/** Un evento ya resuelto: con nombre de persona y rótulo del registro. */
export type ActivityItem = {
  id: number;
  action: string;
  tableName: string;
  actorName: string | null;
  actorLabel: string | null;
  recordLabel: string | null;
  occurredAt: string;
  /** Dónde vive el registro afectado, si sigue siendo alcanzable. */
  href: string | null;
};

/**
 * Últimos movimientos de la bitácora.
 *
 * Solo la persona dueña llega aquí: la composición del ayudante no importa
 * este componente, y `activity_log` tampoco le devolvería una fila.
 *
 * Cada evento se lee como una frase, no como jerga: la redacción vive en
 * `lib/activity/describe.ts`, y desde KAM-22 la comparten esta tarjeta, V23 y
 * los cinco bloques de historial de las pantallas de detalle.
 */
export function RecentActivity({
  items,
  timezone,
  logHref = "/activity",
}: {
  items: readonly ActivityItem[];
  timezone: string;
  /** Por defecto V23, que existe desde KAM-22. */
  logHref?: string;
}) {
  return (
    <Card data-testid="recent-activity">
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
        <Link
          href={logHref}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Ver la bitácora
        </Link>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay movimientos registrados.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const sentence = describeEvent({
                action: item.action,
                tableName: item.tableName,
                actorName: item.actorName,
                actorLabel: item.actorLabel,
                recordLabel: item.recordLabel,
              });

              const row = (
                <>
                  <span className="min-w-0 flex-1 truncate">{sentence}</span>
                  <time
                    dateTime={item.occurredAt}
                    className="shrink-0 text-xs tabular-nums text-muted-foreground"
                  >
                    {formatDateTime(item.occurredAt, timezone)}
                  </time>
                </>
              );

              return (
                <li key={item.id} data-testid={`activity-${item.id}`}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/40"
                    >
                      {row}
                    </Link>
                  ) : (
                    // Un registro que ya no es alcanzable —o una tabla sin
                    // pantalla propia— se cuenta igual: el evento ocurrió.
                    <span className="flex items-center gap-2 px-2 py-1.5 text-sm">
                      {row}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
