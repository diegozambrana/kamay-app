/**
 * El antes y el después de un evento, legible.
 *
 * La bitácora guarda el cambio en crudo —`{"status_id": {"antes": "<uuid>",
 * "despues": "<uuid>"}}`— y esta es la pieza que lo convierte en «Estado:
 * En diseño → En cola». Nada de esto se almacena: se traduce al leer
 * (convención nº 4).
 *
 * Pura y sin Supabase: los nombres de los registros referenciados llegan ya
 * resueltos en un mapa, porque resolverlos es una consulta y esto es `lib/`.
 * Quién los resuelve es `services/activity/label-service.ts`, en lote y una
 * vez por página, no una vez por campo.
 */

import { enumLabel, fieldSpec, UNKNOWN_FIELD_LABEL } from "@/lib/activity/fields";
import { formatDate, formatDateTime } from "@/lib/format/datetime";

/** Una fila de la tabla que se abre bajo el evento. */
export type DiffRow = {
  label: string;
  before: string;
  after: string;
};

/**
 * El detalle de un evento. `purged` no es un caso de error: es lo que queda de
 * un evento cuando la política de retención soltó su detalle, y la pantalla lo
 * declara en vez de fingir una tabla vacía.
 */
export type EventDetail =
  | { kind: "purged" }
  | { kind: "rows"; rows: DiffRow[] };

/** Lo que hace falta para rendir un valor. */
export type RenderContext = {
  timezone: string;
  /** El símbolo o código de la organización: «Bs», «BOB». */
  currency: string;
  /**
   * `uuid` → cómo se llama ese registro o esa persona. Lo que no esté aquí se
   * rinde como referencia sin resolver, nunca como el identificador desnudo:
   * un `uuid` en pantalla es exactamente lo que el requisito prohíbe.
   */
  names: ReadonlyMap<string, string>;
};

/** Lo que se muestra donde no había valor. */
const EMPTY = "—";
/** Lo que se muestra cuando la referencia no se pudo resolver a un nombre. */
const UNRESOLVED = "(sin nombre)";
/** A partir de aquí un texto largo se recorta: la celda no es un documento. */
const LONG_TEXT_LIMIT = 120;

type ChangePair = { antes?: unknown; despues?: unknown };

/**
 * ¿El `changes` de un alta o el de una edición?
 *
 * El trigger guarda la fila entera y plana en un `created`, y pares
 * `{antes, despues}` en todo lo demás. Distinguirlo por la forma del valor y
 * no por la acción evita depender de que quien llame la pase bien.
 */
function isPair(value: unknown): value is ChangePair {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("antes" in value || "despues" in value)
  );
}

/**
 * Las columnas que el trigger copia en un alta pero que no son un cambio que
 * contar.
 *
 * `created_at` y `updated_at` están aquí porque el trigger las excluye del
 * diff de una **edición** (su `v_ignored`) pero no de un alta, donde guarda la
 * fila entera. Sin esta lista, todo evento de creación mostraba dos filas de
 * «Otro dato» con una marca de tiempo: la misma regla que el trigger aplica a
 * un lado hay que aplicarla al otro.
 */
const NEVER_SHOWN = new Set([
  "id",
  "organization_id",
  "created_at",
  "updated_at",
]);

/**
 * Los identificadores que hay que resolver a un nombre antes de rendir.
 *
 * Se expone aparte para que quien lee una página entera de eventos pida todos
 * los nombres de una vez, en lugar de descubrirlos fila por fila.
 */
export function referencedIds(
  tableName: string,
  changes: Record<string, unknown> | null,
): string[] {
  if (!changes) return [];

  const ids: string[] = [];
  for (const [column, raw] of Object.entries(changes)) {
    const spec = fieldSpec(tableName, column);
    if (!spec || (spec.kind !== "reference" && spec.kind !== "user")) continue;

    const values = isPair(raw) ? [raw.antes, raw.despues] : [raw];
    for (const value of values) {
      if (typeof value === "string" && value) ids.push(value);
    }
  }
  return ids;
}

/**
 * El detalle completo de un evento, listo para pintar.
 *
 * Solo los campos que cambiaron: en una edición porque el trigger ya guardó
 * solo esos, y en un alta porque se descartan los que llegaron vacíos —una
 * fila nueva con veinte columnas nulas no es veinte cambios—.
 */
export function buildDetail(
  tableName: string,
  changes: Record<string, unknown> | null,
  context: RenderContext,
): EventDetail {
  if (changes === null) return { kind: "purged" };

  const rows: DiffRow[] = [];

  for (const [column, raw] of Object.entries(changes)) {
    if (NEVER_SHOWN.has(column)) continue;

    const spec = fieldSpec(tableName, column);
    if (spec?.kind === "hidden") continue;

    // Un alta es una fila plana; todo lo demás son pares. En el alta, un
    // campo que nació sin nada no es un cambio que contar: una fila nueva con
    // veinte columnas vacías no son veinte cambios. Un booleano en `false`
    // cuenta como nada aquí —«Es cliente: No» en un alta es ruido—, pero en
    // una edición `Sí → No` es exactamente lo que hay que enseñar, y por eso
    // la regla solo mira el alta.
    if (!isPair(raw)) {
      if (isBlankOnCreate(raw)) continue;
      rows.push({
        label: spec?.label ?? UNKNOWN_FIELD_LABEL,
        before: EMPTY,
        after: renderValue(tableName, column, raw, context),
      });
      continue;
    }

    const before = renderValue(tableName, column, raw.antes, context);
    const after = renderValue(tableName, column, raw.despues, context);

    // El trigger ya descartó lo que no cambió; esto solo cubre el caso de un
    // par con los dos lados vacíos, que no dice nada.
    if (before === EMPTY && after === EMPTY) continue;

    rows.push({
      label: spec?.label ?? UNKNOWN_FIELD_LABEL,
      before,
      after,
    });
  }

  return { kind: "rows", rows };
}

/** En un alta, lo que equivale a no haber puesto nada. */
function isBlankOnCreate(value: unknown): boolean {
  return (
    value === null || value === undefined || value === "" || value === false
  );
}

/**
 * Un valor, en el idioma del producto.
 *
 * Un campo que el diccionario no conoce se rinde por su valor tal cual, sin
 * intentar adivinar su clase: es la única manera de que una columna nueva se
 * vea rara y alguien la añada, en vez de verse bien y pasar desapercibida.
 */
function renderValue(
  tableName: string,
  column: string,
  value: unknown,
  context: RenderContext,
): string {
  if (value === null || value === undefined || value === "") return EMPTY;

  const spec = fieldSpec(tableName, column);
  if (!spec) return String(value);

  switch (spec.kind) {
    case "boolean":
      return value ? "Sí" : "No";

    case "money": {
      const amount = Number(value);
      return Number.isFinite(amount)
        ? `${context.currency} ${amount.toFixed(2)}`
        : String(value);
    }

    case "number":
      return String(value);

    case "date":
      return formatDate(String(value), context.timezone);

    case "datetime":
      return formatDateTime(String(value), context.timezone);

    case "enum":
      return enumLabel(tableName, column, String(value));

    case "reference":
    case "user":
      return context.names.get(String(value)) ?? UNRESOLVED;

    case "long-text": {
      const text = String(value);
      return text.length > LONG_TEXT_LIMIT
        ? `${text.slice(0, LONG_TEXT_LIMIT)}…`
        : text;
    }

    case "hidden":
      // Inalcanzable: `buildDetail` ya los descartó. Aquí por si alguien
      // llama a `renderValue` por su cuenta.
      return EMPTY;

    default:
      return String(value);
  }
}

export const DETAIL_MARKERS = { EMPTY, UNRESOLVED } as const;
