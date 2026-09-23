import { z } from "zod";

import type {
  AttributeScope,
  AttributeValues,
  ItemCategoryAttribute,
} from "@/types";

/**
 * Atributos de catálogo (`catalog-custom-attributes`, design D3).
 *
 * Es la única interpretación de «qué atributos tiene este ítem y qué valores
 * admiten»: la leen el formulario de ítem, el de variante, el detalle, la
 * lista de variantes, el filtro del catálogo y las acciones del servidor, para
 * que ninguno pueda discrepar de los demás. La base solo garantiza que los
 * valores son un objeto; el tipo de cada valor se valida aquí.
 *
 * Los valores se guardan con el id del atributo como clave: renombrar un
 * atributo no toca ningún ítem. Guardar nunca borra lo que no se ofreció —
 * atributos archivados, de otra categoría o claves antiguas—: esos valores se
 * conservan y el detalle los muestra aparte.
 */

/** Prefijo del nombre de cada campo de atributo en un formulario. */
export const ATTRIBUTE_FIELD_PREFIX = "attr:";

/** Lo que llega del formulario o de la petición: texto por campo. */
export type AttributeInput = Record<string, unknown>;

/** Lo validado: un valor por campo ofrecido, o `undefined` si quedó vacío. */
export type ParsedAttributes = Record<string, string | number | undefined>;

/**
 * Los atributos vigentes que una categoría declara para un alcance, en el
 * orden de la definición. Sin categoría no hay atributos.
 */
export function attributeFieldsFor(
  definitions: readonly ItemCategoryAttribute[],
  categoryId: string | null,
  scope: AttributeScope,
): ItemCategoryAttribute[] {
  if (categoryId === null) return [];
  return definitions
    .filter(
      (definition) =>
        definition.categoryId === categoryId &&
        definition.scope === scope &&
        definition.archivedAt === null,
    )
    .sort(byPosition);
}

function byPosition(a: ItemCategoryAttribute, b: ItemCategoryAttribute): number {
  return a.position - b.position || a.name.localeCompare(b.name, "es");
}

/** Un valor vacío es ausencia de dato, no una cadena vacía. */
function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

/**
 * Número escrito en un formulario. Se acepta la coma decimal, que es como se
 * escribe en Bolivia («0,5»). Cualquier otra cosa no es un número.
 */
function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Un color escrito en hex: tres o seis dígitos, con o sin `#`. Devuelve el
 * color normalizado como `#RRGGBB` en mayúsculas, o `null` si no es un hex.
 * Normalizar evita que `#c62828` y `#C62828` parezcan valores distintos
 * (design D11).
 */
export function parseHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : match[1];
  return `#${digits.toUpperCase()}`;
}

/**
 * Una opción de lista que ya no está en la definición, pero que este ítem o
 * esta variante tenía guardada. Se conserva mientras nadie la cambie.
 */
export function isRetiredOption(
  field: ItemCategoryAttribute,
  value: unknown,
): boolean {
  return (
    field.type === "list" &&
    typeof value === "string" &&
    value !== "" &&
    !field.options.includes(value)
  );
}

/**
 * Esquema Zod de los campos ofrecidos. `stored` son los valores que ya tenía
 * el registro: una opción retirada solo se acepta si es la que ya estaba.
 *
 * Cada error lleva el nombre del atributo, para que el formulario y la acción
 * puedan mostrar el primero tal cual.
 */
export function attributesSchema(
  fields: readonly ItemCategoryAttribute[],
  stored: AttributeValues = {},
) {
  const shape: Record<string, z.ZodType<string | number | undefined>> = {};

  for (const field of fields) {
    shape[field.id] = z.unknown().transform((raw, ctx) => {
      if (isBlank(raw)) {
        if (field.required) {
          ctx.addIssue({ code: "custom", message: `«${field.name}» es obligatorio.` });
          return z.NEVER;
        }
        return undefined;
      }

      if (field.type === "number") {
        const parsed = parseNumber(raw);
        if (parsed === null) {
          ctx.addIssue({ code: "custom", message: `«${field.name}» tiene que ser un número.` });
          return z.NEVER;
        }
        return parsed;
      }

      if (field.type === "color") {
        const color = parseHexColor(raw);
        if (color === null) {
          ctx.addIssue({
            code: "custom",
            message: `«${field.name}» tiene que ser un color en hex, como #1A1A1A.`,
          });
          return z.NEVER;
        }
        return color;
      }

      const text = String(raw).trim();

      if (field.type === "list") {
        const keepsStored = stored[field.id] === text;
        if (!field.options.includes(text) && !keepsStored) {
          ctx.addIssue({
            code: "custom",
            message: `«${text}» no es una opción de «${field.name}».`,
          });
          return z.NEVER;
        }
        return text;
      }

      if (text.length > 200) {
        ctx.addIssue({
          code: "custom",
          message: `«${field.name}» admite hasta 200 caracteres.`,
        });
        return z.NEVER;
      }
      return text;
    });
  }

  // Cada campo ofrecido existe siempre en lo que se valida: una clave que no
  // llega es un campo vacío, que un obligatorio rechaza. Lo que no es un campo
  // ofrecido no pasa.
  return z.preprocess((input) => {
    const source =
      input !== null && typeof input === "object" ? (input as Record<string, unknown>) : {};
    return Object.fromEntries(fields.map((field) => [field.id, source[field.id] ?? null]));
  }, z.object(shape));
}

/**
 * Parte de lo guardado y reemplaza solo los campos ofrecidos: un campo vaciado
 * se quita, uno lleno se escribe. Todo lo demás —atributos archivados, de otra
 * categoría, claves antiguas— pasa intacto.
 */
export function mergeAttributes(
  stored: AttributeValues,
  parsed: ParsedAttributes,
  fields: readonly ItemCategoryAttribute[],
): AttributeValues {
  const merged: AttributeValues = { ...stored };
  for (const field of fields) {
    const value = parsed[field.id];
    if (value === undefined) delete merged[field.id];
    else merged[field.id] = value;
  }
  return merged;
}

const NUMBER_FORMAT = new Intl.NumberFormat("es", { maximumFractionDigits: 3 });

/** Un valor guardado, como se lee en pantalla: el número con su unidad. */
export function formatAttributeValue(
  definition: ItemCategoryAttribute | undefined,
  value: unknown,
): string {
  if (isBlank(value)) return "";
  const text =
    typeof value === "number"
      ? NUMBER_FORMAT.format(value)
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return definition?.unit ? `${text} ${definition.unit}` : text;
}

export type DescribedAttribute = {
  id: string;
  label: string;
  value: string;
  /** El hex a pintar como muestra, cuando el atributo es de color y el valor lo es. */
  swatch?: string;
};

/** La muestra de un valor: solo para un atributo de color con un hex válido. */
export function attributeSwatch(
  definition: ItemCategoryAttribute | undefined,
  value: unknown,
): string | undefined {
  if (definition?.type !== "color") return undefined;
  return parseHexColor(value) ?? undefined;
}

function described(
  definition: ItemCategoryAttribute | undefined,
  id: string,
  label: string,
  value: unknown,
): DescribedAttribute {
  const swatch = attributeSwatch(definition, value);
  return {
    id,
    label,
    value: formatAttributeValue(definition, value),
    ...(swatch ? { swatch } : {}),
  };
}

/**
 * Lo que el detalle muestra de un ítem o de una variante:
 *
 * - `current`: los atributos vigentes de su categoría y alcance que tienen
 *   valor, en el orden de la definición y con su nombre de hoy;
 * - `retired`: todo otro valor guardado —de un atributo archivado, de otra
 *   categoría o una clave antigua sin definición—, con su etiqueta si se
 *   conoce y con la clave si no.
 */
export function describeAttributes(
  stored: AttributeValues,
  definitions: readonly ItemCategoryAttribute[],
  categoryId: string | null,
  scope: AttributeScope,
): { current: DescribedAttribute[]; retired: DescribedAttribute[] } {
  const fields = attributeFieldsFor(definitions, categoryId, scope);
  const offered = new Set(fields.map((field) => field.id));
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  const current = fields
    .filter((field) => !isBlank(stored[field.id]))
    .map((field) => described(field, field.id, field.name, stored[field.id]));

  const retiredKeys = Object.keys(stored).filter(
    (key) => !offered.has(key) && !isBlank(stored[key]),
  );
  const known = retiredKeys
    .filter((key) => byId.has(key))
    .map((key) => byId.get(key) as ItemCategoryAttribute)
    .sort(byPosition)
    .map((definition) =>
      described(definition, definition.id, definition.name, stored[definition.id]),
    );
  const unknown = retiredKeys
    .filter((key) => !byId.has(key))
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((key) => described(undefined, key, key, stored[key]));

  return { current, retired: [...known, ...unknown] };
}

/** Los valores de los campos ofrecidos, leídos de un formulario. */
export function attributeInputsFrom(
  data: FormData,
  fields: readonly ItemCategoryAttribute[],
): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const field of fields) {
    inputs[field.id] = String(data.get(`${ATTRIBUTE_FIELD_PREFIX}${field.id}`) ?? "");
  }
  return inputs;
}
