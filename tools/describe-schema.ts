import type { z } from "zod";

/**
 * KAM-27 · De un esquema Zod a la lista de campos que el formulario de
 * parámetros sabe pintar (spec `tenant-tools` → *Los parámetros se editan en
 * un formulario derivado del esquema*; design D7).
 *
 * **Intérprete acotado, a propósito.** Cubre lo que una herramienta necesita
 * —números, texto, sí/no, opciones y listas de filas— y falla con un mensaje
 * claro ante cualquier otra forma, en vez de pintar un campo a medias. La
 * prueba de contrato lo corre sobre cada manifiesto: un tipo no soportado se
 * descubre en CI, no en pantalla.
 *
 * Todo lo que depende de la forma interna de Zod 4 (`def.type`, `innerType`,
 * `element`) está en este archivo y en ninguno más.
 */

/**
 * Cómo se presenta un número. `percent` se muestra ×100 (15) y se guarda como
 * fracción (0,15); `money` lleva la moneda de la organización.
 */
export type NumberKind = "number" | "money" | "percent";

export type FieldMeta = {
  label: string;
  help?: string;
  /** Texto corto junto al campo: «por kilo», «por hora». */
  unit?: string;
  kind?: NumberKind;
  /** Rótulos de las opciones de un `enum`, que en el esquema son códigos. */
  options?: Record<string, string>;
};

type BaseField = { name: string; label: string; help?: string; unit?: string };

export type ScalarField =
  | (BaseField & { type: "number"; kind: NumberKind })
  | (BaseField & { type: "text" })
  | (BaseField & { type: "boolean" })
  | (BaseField & { type: "enum"; options: readonly string[]; labels: Record<string, string> });

export type RowsField = BaseField & { type: "rows"; columns: ScalarField[] };

export type FieldDescriptor = ScalarField | RowsField;

export class UnsupportedSchemaError extends Error {
  constructor(path: string, found: string) {
    super(
      `Tipo de parámetro no soportado en «${path}»: ${found}. El formulario de ` +
        `parámetros cubre number, string, boolean, enum y listas de objetos con esos campos.`,
    );
    this.name = "UnsupportedSchemaError";
  }
}

// La forma interna de Zod 4 no está en sus tipos públicos de forma cómoda.
type ZodInternal = {
  def: {
    type: string;
    innerType?: ZodInternal;
    element?: ZodInternal;
    entries?: Record<string, string>;
  };
  shape?: Record<string, ZodInternal>;
  meta?: () => Record<string, unknown> | undefined;
};

const WRAPPERS = new Set(["default", "optional", "nullable", "prefault"]);

/** Quita `.default()`, `.optional()`… hasta llegar al tipo que importa. */
function unwrap(schema: ZodInternal): ZodInternal {
  let current = schema;
  while (WRAPPERS.has(current.def.type) && current.def.innerType) {
    current = current.def.innerType;
  }
  return current;
}

/** `.meta()` puede haberse puesto antes o después de `.default()`. */
function metaOf(schema: ZodInternal): Partial<FieldMeta> {
  let current: ZodInternal | undefined = schema;
  while (current) {
    const meta = current.meta?.();
    if (meta && typeof meta.label === "string") return meta as Partial<FieldMeta>;
    current = WRAPPERS.has(current.def.type) ? current.def.innerType : undefined;
  }
  return {};
}

function base(name: string, path: string, schema: ZodInternal): BaseField {
  const meta = metaOf(schema);
  if (!meta.label) {
    throw new Error(`El parámetro «${path}» no tiene rótulo: le falta .meta({ label }).`);
  }
  return { name, label: meta.label, help: meta.help, unit: meta.unit };
}

function describeScalar(name: string, path: string, schema: ZodInternal): ScalarField {
  const inner = unwrap(schema);
  const common = base(name, path, schema);

  switch (inner.def.type) {
    case "number":
      return { ...common, type: "number", kind: metaOf(schema).kind ?? "number" };
    case "string":
      return { ...common, type: "text" };
    case "boolean":
      return { ...common, type: "boolean" };
    case "enum":
      return {
        ...common,
        type: "enum",
        options: Object.values(inner.def.entries ?? {}),
        labels: metaOf(schema).options ?? {},
      };
    default:
      throw new UnsupportedSchemaError(path, inner.def.type);
  }
}

function shapeOf(schema: ZodInternal, path: string): Record<string, ZodInternal> {
  const inner = unwrap(schema);
  if (inner.def.type !== "object" || !inner.shape) {
    throw new UnsupportedSchemaError(path, inner.def.type);
  }
  return inner.shape;
}

/** Los campos de un esquema de parámetros, en el orden en que se declararon. */
export function describeSchema(schema: z.ZodType): FieldDescriptor[] {
  const shape = shapeOf(schema as unknown as ZodInternal, "(raíz)");

  return Object.entries(shape).map(([name, field]) => {
    const inner = unwrap(field);
    if (inner.def.type !== "array") return describeScalar(name, name, field);

    const element = inner.def.element;
    if (!element) throw new UnsupportedSchemaError(name, "array sin elemento");
    const columns = Object.entries(shapeOf(element, `${name}[]`)).map(([column, columnSchema]) =>
      describeScalar(column, `${name}[].${column}`, columnSchema),
    );
    return { ...base(name, name, field), type: "rows", columns };
  });
}

/** Los nombres de los campos de primer nivel de un esquema de objeto. */
export function schemaKeys(schema: z.ZodType): string[] {
  return Object.keys(shapeOf(schema as unknown as ZodInternal, "(raíz)"));
}
