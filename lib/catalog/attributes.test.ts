import { describe, expect, it } from "vitest";

import type { ItemCategoryAttribute } from "@/types";

import {
  attributeFieldsFor,
  attributeInputsFrom,
  attributesSchema,
  describeAttributes,
  formatAttributeValue,
  isRetiredOption,
  mergeAttributes,
  parseHexColor,
} from "./attributes";

const FILAMENTO = "cat-filamento";
const SUSTRATOS = "cat-sustratos";

function attribute(
  overrides: Partial<ItemCategoryAttribute> & Pick<ItemCategoryAttribute, "id" | "name">,
): ItemCategoryAttribute {
  return {
    organizationId: "org",
    categoryId: FILAMENTO,
    type: "text",
    unit: null,
    options: [],
    required: false,
    scope: "item",
    position: 1,
    archivedAt: null,
    ...overrides,
  };
}

const MARCA = attribute({ id: "marca", name: "Marca", type: "list", options: ["Sunlu", "eSun"], position: 1 });
const TMIN = attribute({ id: "tmin", name: "Temperatura mínima", type: "number", unit: "°C", position: 2 });
const TMAX = attribute({ id: "tmax", name: "Temperatura máxima", type: "number", unit: "°C", position: 3 });
const VELOCIDAD = attribute({
  id: "vel",
  name: "Velocidad recomendada",
  type: "number",
  unit: "mm/s",
  position: 4,
  archivedAt: "2026-09-21T00:00:00Z",
});
const COLOR = attribute({
  id: "color",
  name: "Color",
  type: "list",
  options: ["Negro", "Rojo"],
  required: true,
  scope: "variant",
  position: 5,
});
const NOTA = attribute({ id: "nota", name: "Nota", position: 6 });
const ACABADO = attribute({ id: "acabado", name: "Acabado", categoryId: SUSTRATOS });

const DEFINITIONS = [COLOR, TMAX, MARCA, VELOCIDAD, TMIN, NOTA, ACABADO];

describe("attributeFieldsFor", () => {
  it("devuelve los atributos de ítem vigentes de la categoría, por posición", () => {
    // «El formulario de ítem ofrece los atributos de ítem», nivel unitario.
    expect(attributeFieldsFor(DEFINITIONS, FILAMENTO, "item").map((f) => f.name)).toEqual([
      "Marca",
      "Temperatura mínima",
      "Temperatura máxima",
      "Nota",
    ]);
  });

  it("devuelve solo los de variante para el formulario de variante", () => {
    // «El formulario de variante ofrece los atributos de su categoría».
    expect(attributeFieldsFor(DEFINITIONS, FILAMENTO, "variant").map((f) => f.name)).toEqual([
      "Color",
    ]);
  });

  it("no ofrece nada sin categoría ni en una categoría sin atributos", () => {
    // «Un ítem sin atributos declarados se ve como hoy», nivel unitario.
    expect(attributeFieldsFor(DEFINITIONS, null, "item")).toEqual([]);
    expect(attributeFieldsFor(DEFINITIONS, "cat-vacia", "item")).toEqual([]);
  });

  it("no aplica la definición de una categoría a otra", () => {
    // «La definición de una categoría no se aplica a otra», nivel unitario.
    expect(attributeFieldsFor(DEFINITIONS, SUSTRATOS, "item").map((f) => f.id)).toEqual([
      "acabado",
    ]);
  });

  it("no ofrece un atributo archivado", () => {
    expect(attributeFieldsFor(DEFINITIONS, FILAMENTO, "item").map((f) => f.id)).not.toContain(
      "vel",
    );
  });
});

describe("attributesSchema", () => {
  it("rechaza un obligatorio vacío con el nombre del atributo", () => {
    // «Un atributo obligatorio sin valor no se guarda», nivel unitario.
    const result = attributesSchema([COLOR]).safeParse({ color: "  " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("«Color» es obligatorio.");
    expect(result.error?.issues[0].path).toEqual(["color"]);
  });

  it("también rechaza el obligatorio que ni siquiera llega", () => {
    expect(attributesSchema([COLOR]).safeParse({}).success).toBe(false);
  });

  it("guarda un número como número, y acepta la coma decimal", () => {
    // «Un número se guarda como número y se muestra con su unidad», nivel unitario.
    const schema = attributesSchema([TMIN, TMAX]);
    expect(schema.parse({ tmin: "190", tmax: "220,5" })).toEqual({ tmin: 190, tmax: 220.5 });
  });

  it("rechaza un valor no numérico", () => {
    // «Un valor no numérico se rechaza», nivel unitario.
    const result = attributesSchema([TMIN]).safeParse({ tmin: "caliente" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("«Temperatura mínima» tiene que ser un número.");
  });

  it("rechaza una opción que no está en la lista", () => {
    // «Una opción que no está en la lista se rechaza», nivel unitario.
    const result = attributesSchema([COLOR]).safeParse({ color: "Verde" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("«Verde» no es una opción de «Color».");
  });

  it("conserva una opción retirada que ya estaba guardada", () => {
    // «Una opción retirada se conserva si no se toca», nivel unitario.
    expect(attributesSchema([COLOR], { color: "Azul" }).parse({ color: "Azul" })).toEqual({
      color: "Azul",
    });
  });

  it("no asigna de nuevo una opción retirada", () => {
    // «Una opción retirada no se asigna de nuevo», nivel unitario.
    expect(attributesSchema([COLOR], { color: "Negro" }).safeParse({ color: "Azul" }).success).toBe(
      false,
    );
  });

  it("un opcional vacío es ausencia de dato", () => {
    expect(attributesSchema([MARCA, NOTA]).parse({ marca: "", nota: "  " })).toEqual({
      marca: undefined,
      nota: undefined,
    });
  });

  it("recorta el texto y limita su largo", () => {
    expect(attributesSchema([NOTA]).parse({ nota: "  mate  " })).toEqual({ nota: "mate" });
    expect(attributesSchema([NOTA]).safeParse({ nota: "x".repeat(201) }).success).toBe(false);
  });

  it("un campo opcional que no llega es ausencia de dato", () => {
    expect(attributesSchema([MARCA, TMIN]).parse({ tmin: "190" })).toEqual({
      marca: undefined,
      tmin: 190,
    });
  });

  it("ignora las claves que no son campos ofrecidos", () => {
    expect(attributesSchema([NOTA]).parse({ nota: "a", intruso: "b" })).toEqual({ nota: "a" });
  });
});

describe("mergeAttributes", () => {
  it("conserva los valores de atributos archivados, de otra categoría y claves antiguas", () => {
    // «Un atributo retirado conserva y muestra su valor» y «Los valores de la
    // categoría anterior se conservan», nivel unitario.
    const stored = { vel: 60, acabado: "mate", capacidad: "11oz", tmin: 180 };
    expect(mergeAttributes(stored, { tmin: 190 }, [TMIN])).toEqual({
      vel: 60,
      acabado: "mate",
      capacidad: "11oz",
      tmin: 190,
    });
  });

  it("quita el valor de un campo ofrecido que quedó vacío", () => {
    expect(mergeAttributes({ nota: "a", vel: 60 }, { nota: undefined }, [NOTA])).toEqual({
      vel: 60,
    });
  });

  it("no toca el objeto guardado", () => {
    const stored = { nota: "a" };
    mergeAttributes(stored, { nota: "b" }, [NOTA]);
    expect(stored).toEqual({ nota: "a" });
  });
});

describe("describeAttributes", () => {
  it("rotula los vigentes con valor, en orden y con unidad", () => {
    const { current } = describeAttributes(
      { tmax: 220, marca: "Sunlu", tmin: 190, nota: "" },
      DEFINITIONS,
      FILAMENTO,
      "item",
    );
    expect(current).toEqual([
      { id: "marca", label: "Marca", value: "Sunlu" },
      { id: "tmin", label: "Temperatura mínima", value: "190 °C" },
      { id: "tmax", label: "Temperatura máxima", value: "220 °C" },
    ]);
  });

  it("usa el nombre vigente de un atributo renombrado", () => {
    // «Renombrar un atributo no pierde valores», nivel unitario.
    const renamed = { ...MARCA, name: "Fabricante" };
    const { current } = describeAttributes({ marca: "Sunlu" }, [renamed], FILAMENTO, "item");
    expect(current).toEqual([{ id: "marca", label: "Fabricante", value: "Sunlu" }]);
  });

  it("separa los retirados: archivados, de otra categoría y claves desconocidas", () => {
    const { current, retired } = describeAttributes(
      { marca: "Sunlu", vel: 60, acabado: "mate", capacidad: "11oz" },
      DEFINITIONS,
      FILAMENTO,
      "item",
    );
    expect(current.map((a) => a.id)).toEqual(["marca"]);
    expect(retired).toEqual([
      { id: "acabado", label: "Acabado", value: "mate" },
      { id: "vel", label: "Velocidad recomendada", value: "60 mm/s" },
      { id: "capacidad", label: "capacidad", value: "11oz" },
    ]);
  });

  it("un ítem que cambió de categoría ve todos sus valores anteriores como retirados", () => {
    const { current, retired } = describeAttributes(
      { marca: "Sunlu", tmin: 190 },
      DEFINITIONS,
      SUSTRATOS,
      "item",
    );
    expect(current).toEqual([]);
    expect(retired.map((a) => a.label)).toEqual(["Marca", "Temperatura mínima"]);
  });
});

describe("formatAttributeValue", () => {
  it("formatea decimales con coma y añade la unidad", () => {
    expect(formatAttributeValue(TMIN, 0.5)).toBe("0,5 °C");
  });

  it("devuelve vacío sin valor", () => {
    expect(formatAttributeValue(TMIN, null)).toBe("");
  });
});

describe("isRetiredOption", () => {
  it("reconoce una opción que ya no está en la lista", () => {
    expect(isRetiredOption(COLOR, "Azul")).toBe(true);
    expect(isRetiredOption(COLOR, "Negro")).toBe(false);
    expect(isRetiredOption(COLOR, "")).toBe(false);
    expect(isRetiredOption(TMIN, "Azul")).toBe(false);
  });
});

describe("attributeInputsFrom", () => {
  it("lee cada campo ofrecido por su nombre con prefijo", () => {
    const data = new FormData();
    data.set("attr:tmin", "190");
    data.set("attr:otro", "x");
    expect(attributeInputsFrom(data, [TMIN, MARCA])).toEqual({ tmin: "190", marca: "" });
  });
});

/** Cambio `catalog-custom-attributes`, tipo `color` (design D11). */
describe("atributos de color", () => {
  const TONO = attribute({ id: "tono", name: "Color de rollo", type: "color", scope: "variant", position: 7 });

  it("normaliza el hex a #RRGGBB en mayúsculas, con o sin #, de 3 o 6 dígitos", () => {
    // «Un color se elige con el selector o se escribe en hex», nivel unitario.
    expect(parseHexColor("c62828")).toBe("#C62828");
    expect(parseHexColor(" #c62828 ")).toBe("#C62828");
    expect(parseHexColor("#abc")).toBe("#AABBCC");
    expect(attributesSchema([TONO]).parse({ tono: "c62828" })).toEqual({ tono: "#C62828" });
  });

  it("rechaza lo que no es un hex", () => {
    // «Un hex mal escrito se rechaza», nivel unitario.
    expect(parseHexColor("rojizo")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    const result = attributesSchema([TONO]).safeParse({ tono: "rojizo" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "«Color de rollo» tiene que ser un color en hex, como #1A1A1A.",
    );
  });

  it("vacío es ausencia de dato, salvo que sea obligatorio", () => {
    expect(attributesSchema([TONO]).parse({ tono: "" })).toEqual({ tono: undefined });
    expect(attributesSchema([{ ...TONO, required: true }]).safeParse({ tono: "" }).success).toBe(false);
  });

  it("la descripción lleva la muestra del color", () => {
    // «El color se ve como muestra», nivel unitario.
    const { current } = describeAttributes({ tono: "#C62828" }, [TONO], FILAMENTO, "variant");
    expect(current).toEqual([
      { id: "tono", label: "Color de rollo", value: "#C62828", swatch: "#C62828" },
    ]);
  });

  it("un valor guardado que no es hex se muestra como texto, sin muestra", () => {
    const { current } = describeAttributes({ tono: "rojo" }, [TONO], FILAMENTO, "variant");
    expect(current).toEqual([{ id: "tono", label: "Color de rollo", value: "rojo" }]);
  });
});
