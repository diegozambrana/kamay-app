import { describe, expect, it } from "vitest";

import type { Status, StatusKind } from "@/types";

import { retargetStatusForLine } from "./line-change";

function status(
  id: string,
  kind: StatusKind,
  position: number,
  name = id,
  archivedAt: string | null = null,
): Status {
  return {
    id,
    organizationId: "org",
    businessLineId: null,
    flow: "task",
    name,
    kind,
    color: "zinc",
    position,
    isQueue: false,
    archivedAt,
  };
}

describe("retargetStatusForLine", () => {
  it("elige el primero de su tipo por posición (Varios estados del mismo tipo)", () => {
    const actual = status("impresion", "in_progress", 3);
    const destino = [
      status("por-hacer", "initial", 1),
      status("impresion-2", "in_progress", 5),
      status("diseno", "in_progress", 2),
    ];

    expect(retargetStatusForLine(actual, destino)).toEqual({
      kind: "moved",
      status: destino[2],
    });
  });

  it("no mira los nombres (El nombre del estado no decide el destino)", () => {
    const actual = status("esperando-horno", "waiting", 4, "Esperando horno");
    const destino = [status("en-pausa", "waiting", 2, "En pausa")];

    expect(retargetStatusForLine(actual, destino)).toEqual({
      kind: "moved",
      status: destino[0],
    });
  });

  it("sin estado de ese tipo no hay destino (La línea nueva no tiene ese tipo)", () => {
    const actual = status("en-pausa", "waiting", 2);
    const destino = [
      status("por-hacer", "initial", 1),
      status("lista", "final", 3),
    ];

    expect(retargetStatusForLine(actual, destino)).toEqual({ kind: "impossible" });
  });

  it("conserva el estado si ya pertenece al juego de la línea nueva", () => {
    const actual = status("por-hacer", "initial", 1);
    const destino = [actual, status("lista", "final", 2)];

    expect(retargetStatusForLine(actual, destino)).toEqual({ kind: "kept" });
  });

  it("ignora los estados archivados del juego destino", () => {
    const actual = status("impresion", "in_progress", 3);
    const destino = [
      status("viejo", "in_progress", 1, "Viejo", "2026-01-01T00:00:00Z"),
      status("diseno", "in_progress", 2),
    ];

    expect(retargetStatusForLine(actual, destino)).toEqual({
      kind: "moved",
      status: destino[1],
    });
  });
});
