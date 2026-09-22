import { describe, expect, it } from "vitest";

import {
  attributeShapeProblem,
  createAttributeDefinitionSchema,
  normalizeForType,
  optionsFromText,
  updateAttributeDefinitionSchema,
} from "./attribute-definition-schema";

const CATEGORY = "00000000-0000-4000-8000-000000000001";
const ID = "00000000-0000-4000-8000-000000000002";

describe("createAttributeDefinitionSchema", () => {
  it("normaliza una lista: opciones recortadas y sin líneas vacías", () => {
    const parsed = createAttributeDefinitionSchema.parse({
      categoryId: CATEGORY,
      name: " Color ",
      type: "list",
      scope: "variant",
      required: true,
      options: optionsFromText("Negro\n Rojo \n\nAzul"),
    });
    expect(parsed).toEqual({
      categoryId: CATEGORY,
      name: "Color",
      type: "list",
      scope: "variant",
      required: true,
      unit: null,
      options: ["Negro", "Rojo", "Azul"],
    });
  });

  it("rechaza una lista sin opciones", () => {
    // «A list attribute needs its options», nivel unitario.
    const result = createAttributeDefinitionSchema.safeParse({
      categoryId: CATEGORY,
      name: "Acabado",
      type: "list",
      scope: "item",
      options: ["", "  "],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Una lista necesita al menos una opción.");
  });

  it("rechaza dos opciones que solo difieren en espacios o mayúsculas", () => {
    // «A list attribute needs its options», nivel unitario.
    const result = createAttributeDefinitionSchema.safeParse({
      categoryId: CATEGORY,
      name: "Color",
      type: "list",
      scope: "variant",
      options: ["Negro", " negro "],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Las opciones de la lista no se pueden repetir.");
  });

  it("descarta la unidad de lo que no es número y las opciones de lo que no es lista", () => {
    const parsed = createAttributeDefinitionSchema.parse({
      categoryId: CATEGORY,
      name: "Marca",
      type: "text",
      scope: "item",
      unit: "kg",
      options: ["Sunlu"],
    });
    expect(parsed.unit).toBeNull();
    expect(parsed.options).toEqual([]);
  });

  it("conserva la unidad de un número", () => {
    const parsed = createAttributeDefinitionSchema.parse({
      categoryId: CATEGORY,
      name: "Temperatura mínima",
      type: "number",
      scope: "item",
      unit: " °C ",
    });
    expect(parsed.unit).toBe("°C");
  });

  it("exige nombre, tipo y alcance", () => {
    expect(
      createAttributeDefinitionSchema.safeParse({ categoryId: CATEGORY, name: "", type: "text", scope: "item" })
        .success,
    ).toBe(false);
    expect(
      createAttributeDefinitionSchema.safeParse({ categoryId: CATEGORY, name: "X", type: "date", scope: "item" })
        .success,
    ).toBe(false);
    expect(
      createAttributeDefinitionSchema.safeParse({ categoryId: CATEGORY, name: "X", type: "text", scope: "order" })
        .success,
    ).toBe(false);
  });
});

describe("updateAttributeDefinitionSchema", () => {
  it("descarta tipo, alcance y categoría aunque lleguen", () => {
    // «Type and scope cannot change», nivel unitario.
    const parsed = updateAttributeDefinitionSchema.parse({
      id: ID,
      name: "Temperatura",
      type: "list",
      scope: "variant",
      categoryId: CATEGORY,
    });
    expect(parsed).toEqual({ id: ID, name: "Temperatura", unit: null, options: [], required: false });
  });
});

describe("attributeShapeProblem y normalizeForType", () => {
  it("solo las listas tienen problemas de opciones", () => {
    expect(attributeShapeProblem("text", { options: [] })).toBeNull();
    expect(attributeShapeProblem("list", { options: ["A"] })).toBeNull();
    expect(attributeShapeProblem("list", { options: [] })).not.toBeNull();
  });

  it("deja cada campo como corresponde a su tipo", () => {
    expect(normalizeForType("list", { unit: "°C", options: ["A"] })).toEqual({ unit: null, options: ["A"] });
    expect(normalizeForType("number", { unit: "°C", options: ["A"] })).toEqual({ unit: "°C", options: [] });
  });
});

describe("tipo color", () => {
  it("un color descarta unidad y opciones", () => {
    const parsed = createAttributeDefinitionSchema.parse({
      categoryId: CATEGORY,
      name: "Color de rollo",
      type: "color",
      scope: "variant",
      unit: "hex",
      options: ["#000000"],
    });
    expect(parsed).toMatchObject({ type: "color", unit: null, options: [] });
  });
});
