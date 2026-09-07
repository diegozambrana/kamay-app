import { describe, expect, it } from "vitest";

import {
  barPercent,
  comparisonRows,
  comparisonScale,
  marginOf,
  NO_CASH_FLOW,
  totalOf,
  type CashFlow,
} from "@/lib/dashboard/indicators";
import type { BusinessLine } from "@/types";

const line = (id: string, name: string, position: number): BusinessLine => ({
  id,
  organizationId: "org",
  name,
  color: "zinc",
  icon: null,
  isShared: false,
  position,
  archivedAt: null,
});

const SUBLIMACION = line("line-1", "Sublimación", 1);
const TRES_D = line("line-2", "3D", 2);
const ALFARERIA = line("line-3", "Alfarería", 3);

describe("marginOf", () => {
  // Scenario: Cobro y pago del mes
  it("resta lo pagado de lo cobrado", () => {
    expect(marginOf({ collected: 900, paid: 350 })).toBe(550);
  });

  // Scenario: El margen negativo se muestra tal cual
  it("devuelve el margen negativo sin recortarlo a cero", () => {
    expect(marginOf({ collected: 200, paid: 800 })).toBe(-600);
  });

  // Scenario: Un mes sin movimiento muestra cero
  it("un mes sin movimiento da cero, no nulo", () => {
    expect(marginOf(NO_CASH_FLOW)).toBe(0);
  });
});

describe("totalOf", () => {
  // Scenario: Con "Todas" se suman las líneas
  it("suma el cobrado y el pagado de todas las líneas", () => {
    const flows: CashFlow[] = [
      { collected: 100, paid: 10 },
      { collected: 200, paid: 20 },
      { collected: 300, paid: 30 },
    ];

    expect(totalOf(flows)).toEqual({ collected: 600, paid: 60 });
  });

  it("sin líneas devuelve ceros y no nulos", () => {
    expect(totalOf([])).toEqual({ collected: 0, paid: 0 });
  });
});

describe("comparisonRows", () => {
  // Scenario: Una fila por línea
  it("devuelve una fila por línea activa, en el orden declarado", () => {
    const rows = comparisonRows(
      [SUBLIMACION, TRES_D, ALFARERIA],
      new Map([
        ["line-1", { collected: 900, paid: 350 }],
        ["line-2", { collected: 100, paid: 0 }],
        ["line-3", { collected: 0, paid: 500 }],
      ]),
    );

    expect(rows.map((row) => row.name)).toEqual([
      "Sublimación",
      "3D",
      "Alfarería",
    ]);
    expect(rows[0]).toMatchObject({ collected: 900, paid: 350 });
  });

  // Scenario: Una línea sin movimiento sigue apareciendo
  it("rellena con ceros la línea que la vista no devuelve", () => {
    const rows = comparisonRows(
      [SUBLIMACION, TRES_D],
      new Map([["line-1", { collected: 900, paid: 350 }]]),
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      businessLineId: "line-2",
      name: "3D",
      collected: 0,
      paid: 0,
    });
  });

  it("una línea del mapa que ya no está activa no inventa una fila", () => {
    const rows = comparisonRows(
      [SUBLIMACION],
      new Map([
        ["line-1", { collected: 10, paid: 0 }],
        ["line-archivada", { collected: 999, paid: 0 }],
      ]),
    );

    expect(rows).toHaveLength(1);
  });
});

describe("barPercent y comparisonScale", () => {
  it("la escala es el mayor valor absoluto de todo el comparativo", () => {
    const scale = comparisonScale([
      { collected: 900, paid: 350 },
      { collected: 100, paid: 1200 },
    ]);

    expect(scale).toBe(1200);
  });

  it("mide cada barra contra esa escala común, no contra su propia fila", () => {
    expect(barPercent(600, 1200)).toBe(50);
    expect(barPercent(1200, 1200)).toBe(100);
  });

  it("con todo en cero ninguna barra se llena y nada se divide por cero", () => {
    expect(comparisonScale([NO_CASH_FLOW, NO_CASH_FLOW])).toBe(0);
    expect(barPercent(0, 0)).toBe(0);
  });

  it("un valor negativo mide su magnitud, no un porcentaje negativo", () => {
    expect(barPercent(-600, 1200)).toBe(50);
  });
});
