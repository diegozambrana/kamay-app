/**
 * Los filtros de V23, que viven en la dirección y no en el cliente.
 *
 * De ahí salen tres cosas del requisito sin escribir código para ninguna: el
 * enlace filtrado se comparte, volver atrás recupera el filtro anterior, y el
 * filtro se aplica en la consulta —porque el servidor solo conoce la consulta,
 * no lo que la pantalla tuviera pintado— (design D10).
 *
 * Puro: ni Supabase ni React. Se prueba con un objeto de parámetros.
 */

import { isCivilDate, startOfDayInTimezone, startOfNextDayInTimezone } from "@/lib/expenses/period";
import { ALL_LINES, type ActiveLine } from "@/types";

/** Las cinco acciones que `activity_log` admite hoy, más «todas». */
export const ACTIONS = [
  "created",
  "updated",
  "status_changed",
  "archived",
  "unarchived",
] as const;
export type ActivityAction = (typeof ACTIONS)[number];

/** Todos los valores posibles de un filtro que no filtra. */
export const ANY = "all" as const;

export type ActivityFilters = {
  /** Fecha civil `YYYY-MM-DD` en la zona de la organización, o `null`. */
  from: string | null;
  to: string | null;
  /** `ALL_LINES` cuando no filtra por línea. */
  line: ActiveLine;
  /** `uuid` de la persona, o `ANY`. */
  actor: string | typeof ANY;
  /** Nombre de tabla auditada, o `ANY`. */
  table: string | typeof ANY;
  action: ActivityAction | typeof ANY;
  /** Lo que se escribió en la búsqueda, sin interpretar. */
  search: string;
  /** El cursor de la página pedida, o `null` para la primera. */
  cursor: string | null;
};

export const EMPTY_FILTERS: ActivityFilters = {
  from: null,
  to: null,
  line: ALL_LINES,
  actor: ANY,
  table: ANY,
  action: ANY,
  search: "",
  cursor: null,
};

/** Lo que llega de `searchParams`, sin validar. */
export type RawParams = Record<string, string | string[] | undefined>;

/**
 * Una fecha civil que además existe en el calendario.
 *
 * `isCivilDate` comprueba el patrón `YYYY-MM-DD` y nada más, así que
 * «2026-13-45» lo pasa; y `startOfDayInTimezone` con eso lanza «Invalid time
 * value», que en una dirección escrita a mano es un 500 en vez de una pantalla
 * sin ese filtro. Se comprueba aquí y no en `lib/expenses/period.ts` porque
 * ese helper lo comparten reportes y egresos, y endurecerlo para todos es un
 * cambio que no es de esta tarea.
 */
function isRealCivilDate(value: string | null): value is string {
  if (!isCivilDate(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  // Si el mes o el día se desbordaron, la fecha reconstruida no coincide:
  // «2026-02-31» se convierte en marzo y se delata.
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function one(params: RawParams, key: string): string | null {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() ? single.trim() : null;
}

/**
 * Los filtros que la dirección pide.
 *
 * **Todo lo inválido se descarta en silencio** y cae al valor que no filtra.
 * Una dirección escrita a mano con `action=borró` no es un error que mostrar:
 * es una dirección que pide algo que no existe, y lo correcto es enseñar la
 * bitácora sin ese filtro, no una pantalla de error.
 */
export function parseFilters(params: RawParams): ActivityFilters {
  const from = one(params, "from");
  const to = one(params, "to");
  const action = one(params, "action");

  const range = normalizeRange(
    isRealCivilDate(from) ? from : null,
    isRealCivilDate(to) ? to : null,
  );

  return {
    from: range.from,
    to: range.to,
    line: one(params, "line") ?? ALL_LINES,
    actor: one(params, "actor") ?? ANY,
    table: one(params, "type") ?? ANY,
    action: (ACTIONS as readonly string[]).includes(action ?? "")
      ? (action as ActivityAction)
      : ANY,
    search: one(params, "q") ?? "",
    cursor: one(params, "after"),
  };
}

/**
 * Un rango al revés no se rechaza: se endereza.
 *
 * Quien escribe «del 19 al 17» quiere los tres días, y devolverle cero
 * resultados sería técnicamente correcto y prácticamente inútil.
 */
function normalizeRange(from: string | null, to: string | null) {
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

/**
 * La dirección que reproduce estos filtros.
 *
 * Solo escribe lo que filtra: una dirección con `line=all&actor=all&action=all`
 * dice lo mismo que `/activity` y es peor de leer y de compartir.
 *
 * El cursor se omite a propósito salvo que se pida: cambiar un filtro tiene
 * que devolver a la primera página, y arrastrar el cursor de la página siete
 * mostraría un hueco sin explicación.
 */
export function toSearchParams(
  filters: ActivityFilters,
  options: { keepCursor?: boolean } = {},
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.line !== ALL_LINES) params.set("line", filters.line);
  if (filters.actor !== ANY) params.set("actor", filters.actor);
  if (filters.table !== ANY) params.set("type", filters.table);
  if (filters.action !== ANY) params.set("action", filters.action);
  if (filters.search) params.set("q", filters.search);
  if (options.keepCursor && filters.cursor) params.set("after", filters.cursor);

  return params;
}

/** `/activity?line=…`, o `/activity` a secas cuando no filtra nada. */
export function activityHref(
  filters: ActivityFilters,
  options: { keepCursor?: boolean } = {},
): string {
  const query = toSearchParams(filters, options).toString();
  return query ? `/activity?${query}` : "/activity";
}

/** La bitácora acotada a un registro: lo que enlaza cada historial de detalle. */
export function recordActivityHref(
  tableName: string,
  recordId: string,
): string {
  return `/activity?${new URLSearchParams({ type: tableName, q: recordId })}`;
}

/** ¿Filtra algo, o es la bitácora entera? Distingue los dos estados vacíos. */
export function hasActiveFilters(filters: ActivityFilters): boolean {
  return (
    filters.from !== null ||
    filters.to !== null ||
    filters.line !== ALL_LINES ||
    filters.actor !== ANY ||
    filters.table !== ANY ||
    filters.action !== ANY ||
    filters.search !== ""
  );
}

/**
 * El rango de fechas civiles convertido a los instantes que la consulta usa.
 *
 * `to` es exclusivo y apunta al principio del día siguiente: quien filtra
 * «hasta el 19» quiere los eventos del 19, incluido el de las 23:50.
 */
export function rangeInstants(
  filters: ActivityFilters,
  timeZone: string,
): { fromInstant: string | null; toInstant: string | null } {
  return {
    fromInstant: filters.from
      ? startOfDayInTimezone(filters.from, timeZone)
      : null,
    toInstant: filters.to ? startOfNextDayInTimezone(filters.to, timeZone) : null,
  };
}
