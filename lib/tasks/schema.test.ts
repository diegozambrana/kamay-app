import { describe, expect, it } from "vitest";

import { quickTaskSchema, taskSchema } from "./schema";

// Un identificador con la forma de la semilla del proyecto: sin versión RFC en
// su sitio. `z.uuid()` lo rechazaría, y por eso el esquema usa `z.guid()`.
const LINE = "30000000-0000-0000-0000-000000000001";

/**
 * KAM-15 · Validación mínima del alta.
 *
 * Escenarios del delta spec `tasks` — requisito "Alta rápida de tarea en tres
 * interacciones o menos" → «Título vacío»; y "Modelo de tarea con título y
 * línea obligatorios" → «Título y línea bastan».
 */
describe("taskSchema", () => {
  it("título y línea bastan", () => {
    const parsed = taskSchema.safeParse({ title: "Revisar filamento", businessLineId: LINE });
    expect(parsed.success).toBe(true);
  });

  it("recorta el título antes de guardarlo", () => {
    const parsed = taskSchema.parse({ title: "  Revisar filamento  ", businessLineId: LINE });
    expect(parsed.title).toBe("Revisar filamento");
  });

  it("un título en blanco no pasa, aunque tenga espacios", () => {
    const parsed = taskSchema.safeParse({ title: "   ", businessLineId: LINE });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Escribe un título para la tarea");
  });

  it("sin línea no se guarda", () => {
    const parsed = taskSchema.safeParse({ title: "Sin línea" });
    expect(parsed.success).toBe(false);
  });

  it("acepta responsable, fecha, etiquetas y vínculo", () => {
    const parsed = taskSchema.safeParse({
      title: "Diseñar arte",
      businessLineId: LINE,
      assigneeId: "20000000-0000-0000-0000-000000000005",
      dueDate: "2026-09-20",
      tagNames: ["hornada-07"],
      link: { entityType: "order", entityId: "50000000-0000-0000-0000-000000000001" },
    });
    expect(parsed.success).toBe(true);
  });

  it("una fecha con otro formato no pasa", () => {
    const parsed = taskSchema.safeParse({
      title: "Diseñar arte",
      businessLineId: LINE,
      dueDate: "20/09/2026",
    });
    expect(parsed.success).toBe(false);
  });

  it("un tipo de vínculo fuera del canon no pasa", () => {
    const parsed = taskSchema.safeParse({
      title: "Diseñar arte",
      businessLineId: LINE,
      link: { entityType: "invoice", entityId: "50000000-0000-0000-0000-000000000001" },
    });
    expect(parsed.success).toBe(false);
  });

  it("el alta rápida solo pide título y línea", () => {
    const parsed = quickTaskSchema.safeParse({ title: "Anotar esto", businessLineId: LINE });
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.data ?? {})).toEqual(["title", "businessLineId"]);
  });

  it("acepta los identificadores de la semilla, que no llevan versión RFC", () => {
    // La regresión que esto fija: con `z.uuid()` el alta fallaba en silencio
    // contra los datos reales, porque ninguna línea sembrada pasa esa validación.
    const parsed = taskSchema.safeParse({
      title: "Contra datos reales",
      businessLineId: "30000000-0000-0000-0000-000000000001",
    });
    expect(parsed.success).toBe(true);
  });
});
