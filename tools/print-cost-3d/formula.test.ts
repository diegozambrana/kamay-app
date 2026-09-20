import { describe, expect, it } from "vitest";

import { SPREADSHEET_CONFIG, SPREADSHEET_ROWS } from "@/tools/print-cost-3d/fixtures";
import { calculate, roundPrice } from "@/tools/print-cost-3d/formula";
import {
  configSchema,
  inputSchema,
  printMinutes,
  type PrintCostInput,
} from "@/tools/print-cost-3d/schema";

/**
 * KAM-27 · spec `print-cost-3d` → *Costo de producción por unidad*, *Precios
 * sugeridos* y *Entradas del cálculo*.
 */
const defaults = configSchema.parse({});
const input = (values: Partial<PrintCostInput>): PrintCostInput => inputSchema.parse(values);

describe("reproduce la hoja de cálculo del taller", () => {
  it.each(SPREADSHEET_ROWS)("$name", ({ input: row, expected }) => {
    const result = calculate(SPREADSHEET_CONFIG, row);
    expect(result.unitCost).toBeCloseTo(expected.unitCost, 6);
    expect(result.unitPrice).toBeCloseTo(expected.unitPrice, 6);
    expect(result.wholesalePrice).toBeCloseTo(expected.wholesalePrice, 6);
    expect(result.dozenPrice).toBeCloseTo(expected.dozenPrice, 5);
  });

  it("el costo no depende de la curva: con los parámetros por defecto es el mismo", () => {
    for (const { input: row, expected } of SPREADSHEET_ROWS) {
      expect(calculate(defaults, row).unitCost).toBeCloseTo(expected.unitCost, 6);
    }
  });
});

describe("costo de producción por unidad", () => {
  it("caso de referencia con varios colores y varias unidades", () => {
    const result = calculate(defaults, input({ grams: 143, minutes: 660, units: 6, colors: 2 }));
    expect(result.materialCost).toBeCloseTo(25.025, 9);
    expect(result.machineCost).toBeCloseTo(30.25, 9);
    expect(result.unitCost).toBeCloseTo(10.594375, 9);
  });

  it("caso de referencia con armado", () => {
    const result = calculate(
      defaults,
      input({ grams: 175, minutes: 484, units: 9, colors: 2, assemblies: 1 }),
    );
    expect(result.assemblyCost).toBe(0.5);
    expect(result.unitCost).toBeCloseTo(7.247731, 6);
  });

  it("un solo color no recarga: el costo es material más máquina", () => {
    const result = calculate(defaults, input({ grams: 175, minutes: 420 }));
    expect(result.unitCost).toBeCloseTo(49.875, 9);
    expect(result.unitCost).toBeCloseTo(result.materialCost + result.machineCost, 9);
  });

  it("fondo de fallos: 20 % sobre un costo de 10 da 12", () => {
    const config = configSchema.parse({ filamentPricePerKg: 1000, failureRate: 0.2 });
    const result = calculate(config, input({ grams: 10 }));
    expect(result.failureCost).toBeCloseTo(2, 9);
    expect(result.unitCost).toBeCloseTo(12, 9);
  });

  it("el fondo de fallos también cubre el armado", () => {
    const config = configSchema.parse({ failureRate: 0.5 });
    expect(calculate(config, input({ assemblies: 2 })).unitCost).toBeCloseTo(1.5, 9);
  });

  it("subir el precio del filamento sube el material en la misma proporción", () => {
    const doubled = configSchema.parse({ filamentPricePerKg: 350 });
    const row = input({ grams: 100, minutes: 60 });
    expect(calculate(doubled, row).materialCost).toBeCloseTo(
      calculate(defaults, row).materialCost * 2,
      9,
    );
    expect(calculate(doubled, row).machineCost).toBe(calculate(defaults, row).machineCost);
  });

  it("placa vacía: todo en cero, sin error", () => {
    const result = calculate(defaults, input({}));
    expect(result.unitCost).toBe(0);
    expect(result.unitPrice).toBe(0);
    expect(result.wholesalePrice).toBe(0);
    expect(result.dozenPrice).toBe(0);
    expect(result.platePrice).toBe(0);
    expect(result.margin).toBe(2.5);
  });
});

describe("precios sugeridos", () => {
  const unrounded = configSchema.parse({
    rounding: "none",
    extras: [{ name: "Clicker", cost: 3 }],
  });

  it("los insumos no llevan margen", () => {
    const row = input({
      grams: 175,
      minutes: 484,
      units: 9,
      colors: 2,
      assemblies: 1,
      extraQuantities: { Clicker: 1 },
    });
    const result = calculate(unrounded, row);
    expect(result.margin).toBe(2.5);
    expect(result.extrasCost).toBe(3);
    expect(result.unitPrice).toBeCloseTo(21.119329, 6);
    expect(result.unitPrice).toBeCloseTo(result.unitCost * 2.5 + 3, 9);
  });

  it("un insumo que ya no está configurado no cuenta", () => {
    const row = input({ grams: 100, extraQuantities: { Clicker: 1, Fantasma: 9 } });
    expect(calculate(unrounded, row).extrasCost).toBe(3);
  });

  it("el margen aplicado sale de la curva según el costo", () => {
    // 1000 Bs/kg hace que los gramos sean el costo: 50 g → 50 de costo.
    const config = configSchema.parse({ filamentPricePerKg: 1000, rounding: "none" });
    const result = calculate(config, input({ grams: 50 }));
    expect(result.margin).toBeCloseTo(1.75, 9);
    expect(result.unitPrice).toBeCloseTo(87.5, 9);
    expect(result.wholesalePrice).toBeCloseTo(70, 9);
    expect(result.dozenPrice).toBeCloseTo(70 * 0.95 * 12, 9);
  });

  it("el ejemplo de la dueña: 70 de costo, 110 de precio", () => {
    const config = configSchema.parse({ filamentPricePerKg: 1000 });
    expect(calculate(config, input({ grams: 70 })).unitPrice).toBe(110);
  });

  it("el precio de la placa es el precio por mayor por las unidades", () => {
    const config = configSchema.parse({ filamentPricePerKg: 1000, rounding: "none" });
    const result = calculate(config, input({ grams: 40, units: 8 }));
    expect(result.platePrice).toBeCloseTo(result.wholesalePrice * 8, 9);
  });

  it("docena y placa salen de valores sin redondear", () => {
    const config = configSchema.parse({});
    const exact = configSchema.parse({ rounding: "none" });
    const row = input({ grams: 143, minutes: 660, units: 6, colors: 2 });
    // Por mayor sin redondear ≈ 21,09: doce veces el redondeado (21) daría
    // 239,40; lo correcto es redondear 21,09 × 0,95 × 12 = 240,48 → 240.
    expect(calculate(config, row).dozenPrice).toBe(Math.round(calculate(exact, row).dozenPrice));
    expect(calculate(config, row).dozenPrice).not.toBe(
      Math.round(calculate(config, row).wholesalePrice * 0.95 * 12),
    );
  });

  it("el redondeo no toca el desglose del costo", () => {
    const row = input({ grams: 143, minutes: 660, units: 6, colors: 2 });
    expect(calculate(defaults, row).unitCost).toBeCloseTo(10.594375, 9);
  });
});

describe("roundPrice", () => {
  it("a la unidad", () => {
    expect(roundPrice(26.87, "unit")).toBe(27);
    expect(roundPrice(26.4, "unit")).toBe(26);
  });

  it("a cincuenta centavos", () => {
    expect(roundPrice(3.35, "half")).toBe(3.5);
    expect(roundPrice(3.2, "half")).toBe(3);
    expect(roundPrice(3.5, "half")).toBe(3.5);
  });

  it("sin redondeo", () => {
    expect(roundPrice(26.8679, "none")).toBe(26.8679);
  });
});

describe("entradas del cálculo", () => {
  it("unidades y colores valen uno por omisión; lo demás, cero", () => {
    expect(inputSchema.parse({})).toEqual({
      grams: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      units: 1,
      colors: 1,
      assemblies: 0,
      extraQuantities: {},
    });
  });

  it("cero unidades se rechaza explicando por qué", () => {
    const parsed = inputSchema.safeParse({ units: 0 });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["units"],
      message: "De la placa tiene que salir al menos una unidad",
    });
  });

  it("gramos negativos, colores en cero y unidades con decimales se rechazan", () => {
    expect(inputSchema.safeParse({ grams: -1 }).error?.issues[0].path).toEqual(["grams"]);
    expect(inputSchema.safeParse({ colors: 0 }).error?.issues[0].path).toEqual(["colors"]);
    expect(inputSchema.safeParse({ units: 1.5 }).success).toBe(false);
    expect(inputSchema.safeParse({ extraQuantities: { Llavero: -1 } }).success).toBe(false);
  });

  it("un tiempo negativo se rechaza marcando su propio campo", () => {
    expect(inputSchema.safeParse({ days: -1 }).error?.issues[0].path).toEqual(["days"]);
    expect(inputSchema.safeParse({ hours: -1 }).error?.issues[0].path).toEqual(["hours"]);
    expect(inputSchema.safeParse({ minutes: -1 }).error?.issues[0].path).toEqual(["minutes"]);
  });
});

describe("el tiempo de impresión en días, horas y minutos", () => {
  it("los tres campos se suman en minutos", () => {
    expect(printMinutes(input({}))).toBe(0);
    expect(printMinutes(input({ hours: 11 }))).toBe(660);
    expect(printMinutes(input({ days: 1, hours: 2, minutes: 30 }))).toBe(1590);
    expect(printMinutes(input({ minutes: 90 }))).toBe(90);
    expect(printMinutes(input({ hours: 1.5 }))).toBe(90);
  });

  it("el mismo tiempo escrito de otra forma da el mismo costo", () => {
    const placa = { grams: 143, units: 6, colors: 2 };
    const enMinutos = calculate(defaults, input({ ...placa, minutes: 660 }));
    const enHoras = calculate(defaults, input({ ...placa, hours: 11 }));
    const repartido = calculate(defaults, input({ ...placa, hours: 10, minutes: 60 }));

    expect(enHoras).toEqual(enMinutos);
    expect(repartido).toEqual(enMinutos);
    expect(enHoras.unitCost).toBeCloseTo(10.594375, 9);
  });

  it("los días cuentan veinticuatro horas", () => {
    // El Mimic Chest de la hoja: sus 2049 min son 1 d 10 h 9 min.
    const enDias = calculate(defaults, input({ grams: 271, days: 1, hours: 10, minutes: 9 }));
    const enMinutos = calculate(defaults, input({ grams: 271, minutes: 2049 }));
    expect(enDias.machineCost).toBeCloseTo(enMinutos.machineCost, 9);
  });
});
