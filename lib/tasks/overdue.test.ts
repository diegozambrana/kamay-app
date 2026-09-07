import { describe, expect, it } from "vitest";

import { dueSignal } from "./overdue";

/**
 * KAM-15 · El semáforo de la fecha límite.
 *
 * Escenarios del delta spec `tasks` — requisito "Tarjeta de tarea": «Fecha
 * límite vencida» y «Tarea sin fecha».
 */
describe("dueSignal", () => {
  it("una fecha pasada está vencida", () => {
    expect(dueSignal("2026-09-01", "2026-09-07")).toBe("overdue");
  });

  it("hoy es hoy", () => {
    expect(dueSignal("2026-09-07", "2026-09-07")).toBe("today");
  });

  it("dentro de dos días avisa", () => {
    expect(dueSignal("2026-09-09", "2026-09-07")).toBe("soon");
  });

  it("más allá no avisa todavía", () => {
    expect(dueSignal("2026-09-20", "2026-09-07")).toBe("later");
  });

  it("sin fecha no hay señal: no es 'a tiempo', es que no hay nada que medir", () => {
    expect(dueSignal(null, "2026-09-07")).toBe("none");
  });

  it("una tarea cerrada deja de avisar aunque su fecha pasara", () => {
    expect(dueSignal("2026-09-01", "2026-09-07", { closed: true })).toBe("none");
  });

  it("el tipo de estado no interviene: una tarea en revisión sí va tarde", () => {
    // A diferencia de los pedidos, donde «en espera» desactiva la alerta: en
    // una tarea propia no hay nadie más a quien esperar.
    expect(dueSignal("2026-09-01", "2026-09-07", {})).toBe("overdue");
  });
});
