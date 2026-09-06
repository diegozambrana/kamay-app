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
): RecentCapture[] {
  const captures: RecentCapture[] = [];

  for (const item of items) {
    const kind = PENDING_KINDS[item.entry.operation];
    if (!kind) continue;

    // `enqueuedAt` es la hora real de la captura; comparar por prefijo de
    // fecha evita reconstruir un `Date` y reintroducir el huso por detrás.
    if (!item.entry.enqueuedAt.startsWith(today)) continue;

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
