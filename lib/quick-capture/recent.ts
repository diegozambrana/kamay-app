import { getOperation } from "@/lib/offline";
import type { SyncItem } from "@/stores/sync-store";

/** De qué tipo es el registro, para rotularlo y para llevarlo a su detalle. */
export type CaptureKind = "order" | "direct-sale" | "purchase" | "cost";

/**
 * Una fila de "Registrado hoy", venga del servidor o de la cola.
 *
 * Las dos mitades se normalizan a esta forma antes de mezclarse, para que la
 * lista ordene y corte sin saber de dónde salió cada fila (design D3b).
 */
export type RecentCapture = {
  kind: CaptureKind;
  /**
   * El `uuid` del registro. Se genera en el cliente y acaba siendo llave
   * primaria (convención nº 9), así que una entrada de la cola y su fila ya
   * sincronizada comparten este valor: la deduplicación es exacta.
   */
  id: string;
  label: string;
  lineId: string | null;
  /** Hora real del hecho, en ISO. */
  occurredAt: string;
  /** A dónde lleva la fila. Ausente mientras el registro no exista aún. */
  href?: string;
  /** Todavía en la cola: no ha llegado al servidor. */
  pending: boolean;
};

/** Cuántas filas muestra la lista. */
export const RECENT_LIMIT = 5;

/**
 * El desplazamiento de una zona horaria respecto de UTC en un instante dado,
 * en minutos.
 *
 * Se deriva formateando el instante en esa zona y comparando el resultado con
 * el propio instante: no depende de `timeZoneName: "longOffset"`, que no todas
 * las versiones de Node formatean igual, y respeta el horario de verano porque
 * se evalúa en la fecha concreta y no con una tabla fija.
 */
function offsetMinutes(timeZone: string, at: Date): number {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((parte) => [parte.type, parte.value]),
  );

  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour) % 24,
    Number(partes.minute),
    Number(partes.second),
  );

  return Math.round((comoUtc - at.getTime()) / 60_000);
}

/**
 * Los dos extremos del día de la organización, como instantes con su
 * desplazamiento explícito.
 *
 * `occurred_at` es `timestamptz`: un literal sin desplazamiento lo interpreta
 * la base en **su** zona, que es UTC. Filtrar con `2026-09-06T00:00:00` a
 * secas no acota el día del taller sino el día UTC, y en La Paz —UTC−4— todo
 * lo registrado a partir de las 20:00 cae fuera y la pantalla afirma que no
 * se registró nada. De ahí que los extremos viajen con su offset.
 */
export function dayBoundsInTimezone(
  day: string,
  timeZone: string,
): { from: string; to: string } {
  // El mediodía del día en cuestión: lejos de los saltos de horario de verano,
  // que siempre ocurren de madrugada, así que el offset resultante es el del día.
  const mediodia = new Date(`${day}T12:00:00Z`);
  const minutos = offsetMinutes(timeZone, mediodia);

  const signo = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  const offset = `${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(
    abs % 60,
  ).padStart(2, "0")}`;

  return {
    from: `${day}T00:00:00.000${offset}`,
    to: `${day}T23:59:59.999${offset}`,
  };
}

/** El día natural de un instante en la zona de la organización (`YYYY-MM-DD`). */
export function dayOfInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Las operaciones de la cola que esta lista sabe representar.
 *
 * Son las que la retícula abre y la cola cubre. `order.update` queda fuera a
 * propósito: la lista dice qué se **registró** hoy, no qué se editó. Una
 * operación que no esté aquí se ignora en silencio —no se adivina su forma—,
 * porque la cola puede llevar cosas que esta pantalla no ofrece.
 */
const PENDING_KINDS: Record<string, CaptureKind> = {
  "order.create": "order",
  "directSale.create": "direct-sale",
};

/**
 * Las capturas de hoy que siguen en la cola del dispositivo.
 *
 * Se lee `useSyncStore`, que es la superficie que KAM-11 declaró para esto, y
 * nunca Dexie directamente. El rótulo lo pone el propio registro de
 * operaciones, para que la lista y la bandeja llamen igual a lo mismo.
 */
export function pendingCapturesToday(
  items: readonly SyncItem[],
  today: string,
  timeZone: string,
): RecentCapture[] {
  const captures: RecentCapture[] = [];

  for (const item of items) {
    const kind = PENDING_KINDS[item.entry.operation];
    if (!kind) continue;

    // `enqueuedAt` es la hora real de la captura, en ISO y por tanto en UTC.
    // Compararla por prefijo contra una fecha de la organización era mezclar
    // dos husos: a las 20:00 en La Paz el instante ya lleva la fecha del día
    // siguiente y la captura desaparecía de la lista.
    if (dayOfInstant(item.entry.enqueuedAt, timeZone) !== today) continue;

    const operation = getOperation(item.entry.operation);

    captures.push({
      kind,
      id: item.entry.recordId,
      label: operation?.describe(item.entry.payload) ?? "Registro pendiente",
      lineId: lineIdOf(item.entry.payload),
      occurredAt: item.entry.enqueuedAt,
      pending: true,
    });
  }

  return captures;
}

/** La línea de negocio del sobre encolado, si la trae. */
function lineIdOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const line = (payload as { businessLineId?: unknown }).businessLineId;
  return typeof line === "string" ? line : null;
}

/**
 * La lista final: lo que el servidor devolvió más lo que sigue en la cola.
 *
 * Una fila pendiente cuyo `id` ya llegó al servidor se descarta: el registro
 * se sincronizó entre una lectura y otra, y mostrarlo dos veces sería peor
 * que no mostrarlo. Manda la del servidor, que es la que sí tiene detalle.
 */
export function mergeRecentCaptures(
  synced: readonly RecentCapture[],
  pending: readonly RecentCapture[],
  limit: number = RECENT_LIMIT,
): RecentCapture[] {
  const alreadySynced = new Set(synced.map((capture) => capture.id));

  return [...synced, ...pending.filter((capture) => !alreadySynced.has(capture.id))]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}
