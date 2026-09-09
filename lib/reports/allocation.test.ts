import { describe, expect, it } from "vitest";

import { type ComparisonRow, allocateSharedExpenses } from "./allocation";

const SUB = "line-sublimacion";
const TRD = "line-3d";
const ALF = "line-alfareria";
const GEN = "line-general";

function rows(
  entries: Array<[string, number, number]>,
  sharedPaid: number,
): ComparisonRow[] {
  return [
    ...entries.map(([businessLineId, collected, paid]) => ({
      businessLineId,
      isShared: false,
      collected,
      paid,
    })),
    { businessLineId: GEN, isShared: true, collected: 0, paid: sharedPaid },
  ];
}

describe("reparto proporcional a los ingresos", () => {
  // Escenario «Reparto proporcional con ingresos desiguales».
  it("asigna en proporción a los ingresos del periodo", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 6000, 0], [TRD, 3000, 0], [ALF, 1000, 0]], 500),
      { rule: "revenue" },
    );

    expect(result.lines.map((l) => l.allocated)).toEqual([300, 150, 50]);
    expect(result.appliedRule).toBe("revenue");
  });

  // Escenario «Ninguna línea tuvo ingresos en el periodo».
  it("cae a partes iguales cuando no hubo ingresos, y lo dice", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 0, 0], [TRD, 0, 0], [ALF, 0, 0]], 300),
      { rule: "revenue" },
    );

    expect(result.lines.map((l) => l.allocated)).toEqual([100, 100, 100]);
    expect(result.appliedRule).toBe("equal");
    expect(result.legend).toContain("ninguna línea registró ingresos");
  });

  // Escenario «Una sola línea activa».
  it("una única línea absorbe el total", () => {
    const result = allocateSharedExpenses(rows([[SUB, 2000, 0]], 500), {
      rule: "revenue",
    });

    expect(result.lines[0].allocated).toBe(500);
  });
});

describe("reparto a partes iguales", () => {
  // Escenario «Tres líneas activas».
  it("divide entre las líneas activas, incluida la que no movió nada", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 5000, 0], [TRD, 0, 0], [ALF, 1000, 0]], 900),
      { rule: "equal" },
    );

    expect(result.lines.map((l) => l.allocated)).toEqual([300, 300, 300]);
  });

  // Escenario «Una línea archivada no participa»: la línea archivada no llega
  // en las filas — `report_line_comparison` ya la excluye —, así que el
  // reparto es entre las que sí llegan.
  it("reparte solo entre las líneas que llegan", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 0, 0], [TRD, 0, 0], [ALF, 0, 0]], 900),
      { rule: "equal" },
    );

    expect(result.lines).toHaveLength(3);
    expect(result.lines.map((l) => l.allocated)).toEqual([300, 300, 300]);
  });
});

describe("reparto manual", () => {
  // Escenario «Porcentajes declarados».
  it("aplica los porcentajes configurados", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 0, 0], [TRD, 0, 0], [ALF, 0, 0]], 1000),
      { rule: "manual", shares: { [SUB]: 50, [TRD]: 30, [ALF]: 20 } },
    );

    expect(result.lines.map((l) => l.allocated)).toEqual([500, 300, 200]);
  });

  // Escenario «Una línea nueva bajo regla manual».
  it("una línea sin porcentaje recibe 0 y no rompe el reparto", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 0, 0], [TRD, 0, 0], [ALF, 0, 0], ["line-nueva", 0, 0]], 1000),
      { rule: "manual", shares: { [SUB]: 50, [TRD]: 30, [ALF]: 20 } },
    );

    expect(result.lines[3].allocated).toBe(0);
    expect(result.lines.reduce((s, l) => s + l.allocated, 0)).toBe(1000);
  });
});

describe("el reparto no altera el total", () => {
  // Escenario «Redondeo que no cuadra».
  it("cierra el céntimo huérfano en la línea de mayor parte", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 0, 0], [TRD, 0, 0], [ALF, 0, 0]], 100),
      { rule: "equal" },
    );

    const shares = result.lines.map((l) => l.allocated);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(100);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
  });

  // Escenario «Sin doble conteo».
  it("la línea compartida no vuelve a aparecer con sus gastos propios", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 1000, 100], [ALF, 1000, 200]], 500),
      { rule: "equal" },
    );

    expect(result.lines.map((l) => l.businessLineId)).toEqual([SUB, ALF]);
    // 100 + 200 propios + 500 repartidos = 800, y los 500 una sola vez.
    expect(result.lines.reduce((s, l) => s + l.expenses, 0)).toBe(800);
    expect(result.sharedTotal).toBe(500);
  });

  it("el margen es ingresos menos egresos ya repartidos, y puede ser negativo", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 100, 50], [ALF, 1000, 0]], 200),
      { rule: "equal" },
    );

    expect(result.lines[0].margin).toBe(100 - (50 + 100));
    expect(result.lines[0].margin).toBeLessThan(0);
  });
});

describe("la leyenda viaja con las cifras", () => {
  // Escenario «Leyenda en el comparativo».
  it("nombra la regla y las proporciones resultantes", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 6000, 0], [TRD, 3000, 0], [ALF, 1000, 0]], 500),
      { rule: "revenue" },
    );

    expect(result.legend).toContain("proporcional a los ingresos");
    expect(result.legend).toContain("60.0 %");
    expect(result.legend).toContain("30.0 %");
  });

  it("un periodo sin gastos compartidos lo dice en vez de callar", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 1000, 0], [ALF, 500, 0]], 0),
      { rule: "revenue" },
    );

    expect(result.sharedTotal).toBe(0);
    expect(result.legend).toContain("No hubo gastos compartidos");
  });

  it("sin ajustes usa la regla por defecto: proporcional a ingresos", () => {
    const result = allocateSharedExpenses(
      rows([[SUB, 3000, 0], [ALF, 1000, 0]], 400),
    );

    expect(result.appliedRule).toBe("revenue");
    expect(result.lines.map((l) => l.allocated)).toEqual([300, 100]);
  });
});
