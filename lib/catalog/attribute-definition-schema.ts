import { z } from "zod";

import { ATTRIBUTE_SCOPES, ATTRIBUTE_TYPES, type AttributeType } from "@/types";

/**
 * Validación de la definición de un atributo de categoría
 * (`catalog-custom-attributes`), compartida por el diálogo de Configuración y
 * las acciones del servidor. La base garantiza la forma (una lista tiene
 * opciones, la unidad es solo de números); aquí se normaliza lo que la base no
 * puede comparar: opciones recortadas, sin vacías y sin repetir.
 */

const name = z
  .string()
  .trim()
  .min(1, "El atributo necesita un nombre")
  .max(60, "El nombre admite hasta 60 caracteres");

/** Vacío es «sin unidad». */
const unit = z
  .string()
  .trim()
  .max(20, "La unidad admite hasta 20 caracteres")
  .nullish()
  .transform((value) => (value ? value : null));

/** Recortadas y sin vacías: una línea en blanco del diálogo no es una opción. */
const options = z
  .array(z.string().max(60, "Cada opción admite hasta 60 caracteres"))
  .default([])
  .transform((values) => values.map((value) => value.trim()).filter((value) => value !== ""));

const fields = {
  name,
  unit,
  options,
  required: z.boolean().default(false),
};

/**
 * Qué falla en la forma de un atributo de ese tipo, o `null` si nada. La usa
 * el alta, que conoce el tipo, y la edición, que lo toma del atributo
 * guardado porque la petición no puede cambiarlo.
 */
export function attributeShapeProblem(
  type: AttributeType,
  values: { options: string[] },
): string | null {
  if (type !== "list") return null;
  if (values.options.length === 0) return "Una lista necesita al menos una opción.";
  const seen = new Set<string>();
  for (const option of values.options) {
    const key = option.toLocaleLowerCase("es");
    if (seen.has(key)) return "Las opciones de la lista no se pueden repetir.";
    seen.add(key);
  }
  return null;
}

/**
 * Deja cada campo como corresponde a su tipo: solo un número lleva unidad y
 * solo una lista lleva opciones. Lo que no corresponde se descarta en vez de
 * rechazarse, porque el diálogo esconde esos campos y puede quedar texto
 * escrito antes de cambiar de tipo.
 */
export function normalizeForType<T extends { unit: string | null; options: string[] }>(
  type: AttributeType,
  values: T,
): T {
  return {
    ...values,
    unit: type === "number" ? values.unit : null,
    options: type === "list" ? values.options : [],
  };
}

export const createAttributeDefinitionSchema = z
  .object({
    ...fields,
    categoryId: z.guid(),
    type: z.enum(ATTRIBUTE_TYPES, { error: "Elige el tipo del atributo" }),
    scope: z.enum(ATTRIBUTE_SCOPES, { error: "Elige a qué se aplica el atributo" }),
  })
  .transform((values) => normalizeForType(values.type, values))
  .superRefine((values, ctx) => {
    const problem = attributeShapeProblem(values.type, values);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["options"] });
  });

export type CreateAttributeDefinition = z.infer<typeof createAttributeDefinitionSchema>;

/**
 * La edición no tiene tipo, alcance ni categoría: no cambian después de
 * creados (lo refuerza un trigger). Zod descarta esas claves si llegan.
 */
export const updateAttributeDefinitionSchema = z.object({
  ...fields,
  id: z.guid(),
});

export type UpdateAttributeDefinition = z.infer<typeof updateAttributeDefinitionSchema>;

/** Las opciones como las escribe la persona en el diálogo: una por línea. */
export function optionsFromText(text: string): string[] {
  return text.split(/\r?\n/);
}
