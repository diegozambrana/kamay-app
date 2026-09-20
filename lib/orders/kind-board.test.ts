import { describe, expect, it } from "vitest";

import type { Status, StatusKind } from "@/types";

import { KIND_COLUMNS, targetStatusFor } from "./kind-board";

function status(
  id: string,
  kind: StatusKind,
  position: number,
  archivedAt: string | null = null,
): Status {
  return {
    id,
    organizationId: "org",
    businessLineId: "line",
    flow: "order",
    name: id,
    kind,
    color: "zinc",
    position,
    isQueue: false,
    archivedAt,
  };
}

describe("KIND_COLUMNS", () => {
  it("son los cinco tipos, en el orden del flujo", () => {
    expect(KIND_COLUMNS.map((column) => column.kind)).toEqual([
      "initial",
      "in_progress",
      "waiting",
      "final",
      "cancelled",
    ]);
    expect(KIND_COLUMNS.map((column) => column.label)).toEqual([
      "Por empezar",
      "En curso",
      "En espera",
      "Terminados",
      "Cancelados",
    ]);
  });
});

describe("targetStatusFor", () => {
  it("elige el primer estado de ese tipo por posición (Mover al primer estado de ese tipo)", () => {
    const juego = [
      status("Registrado", "initial", 1),
      status("Impresión", "in_progress", 3),
      status("Diseño", "in_progress", 2),
      status("Entregado", "final", 4),
    ];

    expect(targetStatusFor(juego, "in_progress")?.id).toBe("Diseño");
  });

  it("sin estado de ese tipo devuelve null (La línea del pedido no tiene ese tipo)", () => {
    const juego = [status("Registrado", "initial", 1), status("Entregado", "final", 2)];

    expect(targetStatusFor(juego, "waiting")).toBeNull();
  });

  it("ignora los estados archivados", () => {
    const juego = [
      status("Viejo", "in_progress", 1, "2026-01-01T00:00:00Z"),
      status("Nuevo", "in_progress", 2),
    ];

    expect(targetStatusFor(juego, "in_progress")?.id).toBe("Nuevo");
    expect(
      targetStatusFor([status("Viejo", "waiting", 1, "2026-01-01T00:00:00Z")], "waiting"),
    ).toBeNull();
  });
});
