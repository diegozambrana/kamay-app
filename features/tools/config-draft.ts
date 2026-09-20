import type { FieldDescriptor, ScalarField } from "@/tools/describe-schema";

/**
 * KAM-27 · El borrador del formulario de parámetros (design D7).
 *
 * En pantalla todo número es **texto** —para poder escribir «2,» camino de
 * «2,75» sin que el campo salte— y los porcentajes se ven ×100 (15) aunque se
 * guarden como fracción (0,15). Este módulo es el ida y vuelta entre esos dos
 * mundos, puro y probado aparte del componente.
 */

export type DraftScalar = string | boolean;
export type DraftRow = { key: string; values: Record<string, DraftScalar> };
export type Draft = Record<string, DraftScalar | DraftRow[]>;

let rowKey = 0;
/** Llave estable de una fila: React la necesita para no mezclar filas al quitar una. */
export function nextRowKey(): string {
  rowKey += 1;
  return `row-${rowKey}`;
}

/** 1,57 × 100 da 157,00000000000003; nadie quiere ver eso en un campo. */
function tidy(value: number): string {
  return String(Number(value.toFixed(6)));
}

function toDraftScalar(field: ScalarField, value: unknown): DraftScalar {
  if (field.type === "boolean") return value === true;
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    return tidy(field.kind === "percent" ? value * 100 : value);
  }
  return typeof value === "string" ? value : "";
}

/** Acepta la coma decimal. Un campo vacío o ilegible es `NaN`: lo rechaza el esquema. */
function parseNumber(text: string): number {
  const clean = text.trim().replace(",", ".");
  return clean === "" ? Number.NaN : Number(clean);
}

function fromDraftScalar(field: ScalarField, value: DraftScalar | undefined): unknown {
  if (field.type === "boolean") return value === true;
  if (field.type === "number") {
    const parsed = parseNumber(String(value ?? ""));
    return field.kind === "percent" ? Number((parsed / 100).toFixed(8)) : parsed;
  }
  return String(value ?? "");
}

export function emptyRow(columns: readonly ScalarField[]): DraftRow {
  return {
    key: nextRowKey(),
    values: Object.fromEntries(
      columns.map((column) => [column.name, column.type === "boolean" ? false : ""]),
    ),
  };
}

export function toDraft(fields: readonly FieldDescriptor[], config: Record<string, unknown>): Draft {
  return Object.fromEntries(
    fields.map((field) => {
      const value = config[field.name];
      if (field.type !== "rows") return [field.name, toDraftScalar(field, value)];

      const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      return [
        field.name,
        rows.map((row) => ({
          key: nextRowKey(),
          values: Object.fromEntries(
            field.columns.map((column) => [column.name, toDraftScalar(column, row?.[column.name])]),
          ),
        })),
      ];
    }),
  );
}

export function fromDraft(fields: readonly FieldDescriptor[], draft: Draft): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = draft[field.name];
      if (field.type !== "rows") {
        return [field.name, fromDraftScalar(field, value as DraftScalar | undefined)];
      }
      return [
        field.name,
        ((value as DraftRow[] | undefined) ?? []).map((row) =>
          Object.fromEntries(
            field.columns.map((column) => [
              column.name,
              fromDraftScalar(column, row.values[column.name]),
            ]),
          ),
        ),
      ];
    }),
  );
}

/** `["marginCurve", 1, "margin"]` → `"marginCurve.1.margin"`. */
export function pathKey(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

/** El primer mensaje de cada camino: un campo muestra un solo error a la vez. */
export function issuesByPath(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const byPath: Record<string, string> = {};
  for (const issue of issues) {
    const key = pathKey(issue.path);
    if (!(key in byPath)) byPath[key] = issue.message;
  }
  return byPath;
}
