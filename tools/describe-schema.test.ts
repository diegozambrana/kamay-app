import { describe, expect, it } from "vitest";
import { z } from "zod";

import { UnsupportedSchemaError, describeSchema, schemaKeys } from "@/tools/describe-schema";

/** KAM-27 · design D7: qué formas de Zod sabe pintar el formulario de parámetros. */
describe("describeSchema", () => {
  const schema = z
    .object({
      price: z.number().min(0).default(175).meta({ label: "Precio", unit: "por kilo", kind: "money" }),
      rate: z.number().default(0.15).meta({ label: "Recargo", kind: "percent", help: "Por color" }),
      count: z.number().meta({ label: "Cantidad" }).default(1),
      note: z.string().default("").meta({ label: "Nota" }),
      enabled: z.boolean().default(false).meta({ label: "Activo" }),
      rounding: z
        .enum(["none", "half", "unit"])
        .default("unit")
        .meta({ label: "Redondeo", options: { unit: "A la unidad" } }),
      extras: z
        .array(
          z.object({
            name: z.string().meta({ label: "Nombre" }),
            cost: z.number().meta({ label: "Costo", kind: "money" }),
          }),
        )
        .default([])
        .meta({ label: "Insumos", help: "Lo que se añade a la pieza" }),
    })
    .superRefine(() => {});

  it("describe cada campo en el orden declarado", () => {
    expect(describeSchema(schema).map((field) => field.name)).toEqual([
      "price",
      "rate",
      "count",
      "note",
      "enabled",
      "rounding",
      "extras",
    ]);
  });

  it("número con su presentación, su unidad y su ayuda", () => {
    const [price, rate, count] = describeSchema(schema);
    expect(price).toEqual({
      name: "price",
      label: "Precio",
      help: undefined,
      unit: "por kilo",
      type: "number",
      kind: "money",
    });
    expect(rate).toMatchObject({ type: "number", kind: "percent", help: "Por color" });
    // `.meta()` antes de `.default()` también se encuentra, y sin `kind` es un número llano.
    expect(count).toMatchObject({ label: "Cantidad", type: "number", kind: "number" });
  });

  it("texto, sí/no y opciones cerradas", () => {
    const fields = describeSchema(schema);
    expect(fields[3]).toMatchObject({ type: "text", label: "Nota" });
    expect(fields[4]).toMatchObject({ type: "boolean", label: "Activo" });
    expect(fields[5]).toMatchObject({
      type: "enum",
      options: ["none", "half", "unit"],
      labels: { unit: "A la unidad" },
    });
  });

  it("lista de filas con sus columnas", () => {
    const extras = describeSchema(schema)[6];
    expect(extras).toMatchObject({ type: "rows", label: "Insumos" });
    expect(extras.type === "rows" && extras.columns).toEqual([
      { name: "name", label: "Nombre", help: undefined, unit: undefined, type: "text" },
      { name: "cost", label: "Costo", help: undefined, unit: undefined, type: "number", kind: "money" },
    ]);
  });

  it("un tipo que no sabe pintar falla con el camino del campo", () => {
    const bad = z.object({ when: z.date().meta({ label: "Cuándo" }) });
    expect(() => describeSchema(bad)).toThrow(UnsupportedSchemaError);
    expect(() => describeSchema(bad)).toThrow(/«when»: date/);
  });

  it("una lista de algo que no es un objeto falla", () => {
    const bad = z.object({ tags: z.array(z.string()).meta({ label: "Etiquetas" }) });
    expect(() => describeSchema(bad)).toThrow(/«tags\[\]»/);
  });

  it("una fila con un campo anidado falla", () => {
    const bad = z.object({
      rows: z.array(z.object({ inner: z.object({}).meta({ label: "X" }) })).meta({ label: "Filas" }),
    });
    expect(() => describeSchema(bad)).toThrow(/«rows\[\]\.inner»/);
  });

  it("un campo sin rótulo falla", () => {
    expect(() => describeSchema(z.object({ price: z.number() }))).toThrow(/no tiene rótulo/);
  });

  it("la raíz tiene que ser un objeto", () => {
    expect(() => describeSchema(z.string())).toThrow(UnsupportedSchemaError);
  });
});

describe("schemaKeys", () => {
  it("lista las claves de primer nivel", () => {
    expect(schemaKeys(z.object({ a: z.number(), b: z.string() }))).toEqual(["a", "b"]);
  });
});
