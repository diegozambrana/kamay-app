import { describe, expect, it } from "vitest";

import {
  midpoint,
  queuePositions,
  renormalize,
  reorderedIds,
  sortByArrival,
} from "@/lib/orders/queue";

/**
 * Tres pedidos cuya fecha comprometida va en orden INVERSO a la llegada: si
 * algo ordenara por urgencia en vez de por antigüedad, estas pruebas lo
 * delatarían.
 */
const cola = [
  { id: "primero",  queuedAt: "2026-08-24T10:00:00.000Z", code: 1, dueDate: "2026-09-05" },
  { id: "segundo",  queuedAt: "2026-08-25T10:00:00.000Z", code: 2, dueDate: "2026-09-01" },
  { id: "tercero",  queuedAt: "2026-08-26T10:00:00.000Z", code: 3, dueDate: "2026-08-29" },
];

describe("queuePositions", () => {
  it("numera 1, 2, 3 por orden de llegada", () => {
    const posiciones = queuePositions(cola);
    expect(posiciones.get("primero")).toBe(1);
    expect(posiciones.get("segundo")).toBe(2);
    expect(posiciones.get("tercero")).toBe(3);
  });

  it("no numera por fecha comprometida", () => {
    // Por urgencia el orden sería el inverso; la cola no lo usa.
    const porUrgencia = [...cola].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    expect(porUrgencia.map((o) => o.id)).toEqual(["tercero", "segundo", "primero"]);
    expect(sortByArrival(cola).map((o) => o.id)).toEqual(["primero", "segundo", "tercero"]);
  });

  it("desempata por número cuando dos llegadas coinciden", () => {
    const empate = [
      { id: "b", queuedAt: "2026-08-24T10:00:00.000Z", code: 9 },
      { id: "a", queuedAt: "2026-08-24T10:00:00.000Z", code: 4 },
    ];
    expect(sortByArrival(empate).map((o) => o.id)).toEqual(["a", "b"]);
  });

  it("es indiferente al orden en que llegan los datos", () => {
    const barajado = [cola[2], cola[0], cola[1]];
    expect(sortByArrival(barajado).map((o) => o.id)).toEqual([
      "primero",
      "segundo",
      "tercero",
    ]);
  });
});

describe("reorderedIds", () => {
  const ids = ["primero", "segundo", "tercero"];

  it("adelantar el tercero al frente renumera al resto a 2 y 3", () => {
    const resultado = reorderedIds(ids, "tercero", 0);
    expect(resultado).toEqual(["tercero", "primero", "segundo"]);

    const posiciones = queuePositions(
      resultado.map((id, index) => ({
        id,
        queuedAt: `2026-08-24T10:00:0${index}.000Z`,
        code: index + 1,
      })),
    );
    expect([...posiciones.values()]).toEqual([1, 2, 3]);
  });

  it("retrasar el primero al final deja a los otros dos en 1 y 2", () => {
    expect(reorderedIds(ids, "primero", 2)).toEqual(["segundo", "tercero", "primero"]);
  });

  it("no deja huecos ni repeticiones", () => {
    const resultado = reorderedIds(ids, "segundo", 0);
    expect(new Set(resultado).size).toBe(ids.length);
    expect([...resultado].sort()).toEqual([...ids].sort());
  });

  it("acota un destino fuera de rango en vez de romperse", () => {
    expect(reorderedIds(ids, "primero", 99)).toEqual(["segundo", "tercero", "primero"]);
    expect(reorderedIds(ids, "tercero", -5)).toEqual(["tercero", "primero", "segundo"]);
  });
});

describe("midpoint", () => {
  it("cae entre las dos vecinas", () => {
    const resultado = midpoint("2026-08-24T10:00:00.000Z", "2026-08-26T10:00:00.000Z");
    expect(resultado.kind).toBe("ok");
    if (resultado.kind !== "ok") return;
    expect(resultado.queuedAt > "2026-08-24T10:00:00.000Z").toBe(true);
    expect(resultado.queuedAt < "2026-08-26T10:00:00.000Z").toBe(true);
  });

  it("al frente queda antes de quien era primero", () => {
    const resultado = midpoint(null, "2026-08-24T10:00:00.000Z");
    expect(resultado.kind).toBe("ok");
    if (resultado.kind !== "ok") return;
    expect(resultado.queuedAt < "2026-08-24T10:00:00.000Z").toBe(true);
  });

  it("al final queda después de quien era último", () => {
    const resultado = midpoint("2026-08-24T10:00:00.000Z", null);
    expect(resultado.kind).toBe("ok");
    if (resultado.kind !== "ok") return;
    expect(resultado.queuedAt > "2026-08-24T10:00:00.000Z").toBe(true);
  });

  it("pide renormalizar cuando ya no cabe un valor entre las vecinas", () => {
    const resultado = midpoint(
      "2026-08-24T10:00:00.000Z",
      "2026-08-24T10:00:00.001Z",
    );
    expect(resultado.kind).toBe("needs_renormalization");
  });
});

describe("renormalize", () => {
  it("reespacia la cola conservando el orden pedido", () => {
    const nuevo = renormalize(["tercero", "primero", "segundo"]);
    const ordenado = sortByArrival(
      ["tercero", "primero", "segundo"].map((id, index) => ({
        id,
        queuedAt: nuevo.get(id)!,
        code: index + 1,
      })),
    );
    expect(ordenado.map((o) => o.id)).toEqual(["tercero", "primero", "segundo"]);
  });

  it("deja hueco de sobra para volver a insertar por el medio", () => {
    const nuevo = renormalize(["a", "b"]);
    expect(midpoint(nuevo.get("a")!, nuevo.get("b")!).kind).toBe("ok");
  });
});
