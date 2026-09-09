import { describe, expect, it } from "vitest";

import { scopedToLine, shortfallRatio, sortByUrgency } from "./stock";

import type { ItemBalance } from "@/types";

function balance(overrides: Partial<ItemBalance> & { itemId: string }): ItemBalance {
  return {
    organizationId: "org",
    balance: 0,
    minStock: null,
    belowMin: false,
    ...overrides,
  };
}

describe("shortfallRatio", () => {
  it("es cero para lo que no está bajo mínimo", () => {
    expect(
      shortfallRatio(balance({ itemId: "a", balance: 57, minStock: 12 })),
    ).toBe(0);
  });

  // Escenario "Insumo sin mínimo declarado": sin mínimo no hay alerta posible.
  it("es cero para un insumo sin mínimo declarado", () => {
    expect(
      shortfallRatio(balance({ itemId: "a", balance: 0, minStock: null })),
    ).toBe(0);
  });

  it("mide la distancia en proporción al mínimo, no en unidades", () => {
    const critico = balance({ itemId: "a", balance: 2, minStock: 10, belowMin: true });
    const holgado = balance({ itemId: "b", balance: 40, minStock: 50, belowMin: true });

    // Al crítico le faltan 8 unidades y al holgado 10, pero el crítico está peor.
    expect(shortfallRatio(critico)).toBeGreaterThan(shortfallRatio(holgado));
  });

  it("un mínimo de cero con saldo negativo es lo más urgente que hay", () => {
    expect(
      shortfallRatio(balance({ itemId: "a", balance: -3, minStock: 0, belowMin: true })),
    ).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("sortByUrgency", () => {
  // Escenario "Los insumos por debajo del mínimo aparecen": el más alejado de
  // su mínimo primero.
  it("ordena del más urgente al menos y descarta lo que está sano", () => {
    const rows = [
      balance({ itemId: "sano", balance: 57, minStock: 12 }),
      balance({ itemId: "holgado", balance: 40, minStock: 50, belowMin: true }),
      balance({ itemId: "critico", balance: 2, minStock: 10, belowMin: true }),
    ];

    expect(sortByUrgency(rows).map((row) => row.itemId)).toEqual(["critico", "holgado"]);
  });

  it("deshace el empate por identificador para que el orden sea estable", () => {
    const rows = [
      balance({ itemId: "b", balance: 5, minStock: 10, belowMin: true }),
      balance({ itemId: "a", balance: 5, minStock: 10, belowMin: true }),
    ];

    expect(sortByUrgency(rows).map((row) => row.itemId)).toEqual(["a", "b"]);
  });

  it("no muta el arreglo que recibe", () => {
    const rows = [
      balance({ itemId: "holgado", balance: 40, minStock: 50, belowMin: true }),
      balance({ itemId: "critico", balance: 2, minStock: 10, belowMin: true }),
    ];

    sortByUrgency(rows);
    expect(rows[0].itemId).toBe("holgado");
  });

  it("devuelve una lista vacía cuando nada está bajo mínimo", () => {
    expect(sortByUrgency([balance({ itemId: "a", balance: 57, minStock: 12 })])).toEqual([]);
  });
});

describe("scopedToLine", () => {
  const SUBLIMACION = "line-sublimacion";
  const ALFARERIA = "line-alfareria";

  const items = new Map([
    ["propio", { businessLineId: SUBLIMACION, archivedAt: null }],
    ["ajeno", { businessLineId: ALFARERIA, archivedAt: null }],
    ["compartido", { businessLineId: null, archivedAt: null }],
    ["archivado", { businessLineId: SUBLIMACION, archivedAt: "2026-09-01T00:00:00Z" }],
  ]);

  const balances = [
    balance({ itemId: "propio", belowMin: true }),
    balance({ itemId: "ajeno", belowMin: true }),
    balance({ itemId: "compartido", belowMin: true }),
    balance({ itemId: "archivado", belowMin: true }),
  ];

  // Escenario "La alerta respeta la línea activa": lo transversal es de todos
  // por definición, así que lo compartido entra siempre.
  it("una línea concreta trae lo suyo y lo compartido, nunca lo ajeno", () => {
    const scoped = scopedToLine(balances, items, SUBLIMACION);

    expect(scoped.map((row) => row.itemId).sort()).toEqual(["compartido", "propio"]);
  });

  it("«Todas» trae todo lo vigente", () => {
    const scoped = scopedToLine(balances, items, null);

    expect(scoped.map((row) => row.itemId).sort()).toEqual([
      "ajeno",
      "compartido",
      "propio",
    ]);
  });

  // Archivar retira de los listados sin borrar la historia: un insumo
  // archivado no debe pedir que lo compren.
  it("descarta los insumos archivados en cualquier alcance", () => {
    expect(
      scopedToLine(balances, items, null).map((row) => row.itemId),
    ).not.toContain("archivado");
    expect(
      scopedToLine(balances, items, SUBLIMACION).map((row) => row.itemId),
    ).not.toContain("archivado");
  });

  // Sin poder comprobar su línea ni su archivado, mostrarlo sería adivinar.
  it("descarta un saldo cuyo ítem no conoce", () => {
    const huerfano = [balance({ itemId: "desconocido", belowMin: true })];

    expect(scopedToLine(huerfano, items, null)).toEqual([]);
  });
});
