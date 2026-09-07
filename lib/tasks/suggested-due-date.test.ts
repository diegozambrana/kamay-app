import { describe, expect, it } from "vitest";

import { suggestedDueDate } from "./suggested-due-date";

/**
 * KAM-15 · La fecha que propone *Crear tarea para este pedido*.
 *
 * Escenarios del delta spec `tasks` — requisito "Crear tarea para este pedido
 * con formulario prellenado": «Formulario prellenado» (anterior a la de
 * entrega), «Pedido sin fecha comprometida» y «La fecha sugerida nunca queda
 * en el pasado».
 */
describe("suggestedDueDate", () => {
  it("propone una fecha anterior a la comprometida", () => {
    expect(suggestedDueDate("2026-09-20", "2026-09-07")).toBe("2026-09-18");
  });

  it("la propuesta es siempre estrictamente anterior a la entrega", () => {
    const entrega = "2026-09-20";
    const propuesta = suggestedDueDate(entrega, "2026-09-01");
    expect(propuesta! < entrega).toBe(true);
  });

  it("sin fecha comprometida no propone ninguna", () => {
    expect(suggestedDueDate(null, "2026-09-07")).toBeNull();
  });

  it("si la propuesta caería en el pasado, propone hoy", () => {
    // Entrega mañana: dos días antes sería ayer, y una tarea no nace vencida.
    expect(suggestedDueDate("2026-09-08", "2026-09-07")).toBe("2026-09-07");
  });

  it("con la entrega hoy, propone hoy", () => {
    expect(suggestedDueDate("2026-09-07", "2026-09-07")).toBe("2026-09-07");
  });

  it("con la entrega ya pasada, propone hoy y no una fecha vencida", () => {
    expect(suggestedDueDate("2026-09-01", "2026-09-07")).toBe("2026-09-07");
  });

  it("cruza el fin de mes sin inventar días", () => {
    expect(suggestedDueDate("2026-10-01", "2026-09-01")).toBe("2026-09-29");
  });

  it("cuenta bien en un año bisiesto", () => {
    expect(suggestedDueDate("2028-03-01", "2028-01-01")).toBe("2028-02-28");
  });
});
