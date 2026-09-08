import { describe, expect, it } from "vitest";

import { destinationOf } from "./destination";

/**
 * KAM-17 · A dónde lleva cada aviso.
 *
 * Escenarios del delta spec `notifications` — requisito "Cada aviso lleva a su
 * registro": «Del aviso a la tarea», «Del resumen a los pendientes» y
 * «Registro ya no disponible».
 */
describe("destinationOf", () => {
  it("un aviso de tarea abre esa tarea concreta", () => {
    expect(
      destinationOf({
        type: "task_assigned",
        entityType: "task",
        entityId: "t1",
      }),
    ).toEqual({ kind: "path", path: "/tasks/t1" });
  });

  it("el resumen diario lleva a Mis pendientes", () => {
    // Resume varias tareas: no hay un registro al que apuntar, y llevar al
    // panel sería la «pantalla genérica» que el criterio prohíbe.
    expect(
      destinationOf({ type: "due_summary", entityType: null, entityId: null }),
    ).toEqual({ kind: "path", path: "/my-tasks" });
  });

  it("un aviso cuyo registro ya no está disponible lo declara", () => {
    expect(
      destinationOf(
        { type: "task_overdue", entityType: "task", entityId: "t1" },
        false,
      ),
    ).toEqual({ kind: "unavailable" });
  });

  it("un aviso sin registro referido no lleva a ninguna parte", () => {
    expect(
      destinationOf({
        type: "task_overdue",
        entityType: "task",
        entityId: null,
      }),
    ).toEqual({ kind: "unavailable" });
  });

  it("un aviso de inventario abre el detalle de su ítem", () => {
    // El generador llega con KAM-18; el destino ya se resuelve, porque el tipo
    // existe en el catálogo desde esta migración.
    expect(
      destinationOf({
        type: "stock_below_min",
        entityType: "item",
        entityId: "i1",
      }),
    ).toEqual({ kind: "path", path: "/catalog/i1" });
  });

  it("un tipo de registro desconocido no inventa una ruta", () => {
    expect(
      destinationOf({
        type: "task_overdue",
        entityType: "unicornio",
        entityId: "x1",
      }),
    ).toEqual({ kind: "unavailable" });
  });
});
