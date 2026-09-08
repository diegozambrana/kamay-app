import { describe, expect, it } from "vitest";

import {
  dueSummaryKey,
  taskAssignedKey,
  taskOverdueKey,
  taskReviewKey,
  taskStalledKey,
} from "./dedupe";

/**
 * KAM-17 · Llaves de idempotencia.
 *
 * Escenarios del delta spec `notifications` — requisito "Ningún hecho genera
 * dos avisos": «Reejecución sin duplicados» y «Vencida una vez, no cada día».
 *
 * La unicidad la impone la base (`unique (user_id, dedupe_key)`, probada en
 * `supabase/tests/notifications.test.sql`). Lo que se comprueba aquí es lo que
 * hace que esa unicidad signifique algo: que la llave nombre **el hecho** y no
 * la pasada del trabajo que lo detectó.
 */
describe("llaves de idempotencia", () => {
  it("la misma tarea vencida da la misma llave tres días seguidos", () => {
    // El escenario «Vencida una vez, no cada día». La llave lleva la fecha
    // límite, no el día de la pasada: por eso el trabajo puede correr cada día
    // sin generar un aviso nuevo cada vez.
    const dia1 = taskOverdueKey("t1", "2026-09-01");
    const dia2 = taskOverdueKey("t1", "2026-09-01");
    const dia3 = taskOverdueKey("t1", "2026-09-01");

    expect(new Set([dia1, dia2, dia3]).size).toBe(1);
  });

  it("reprogramar la tarea sí produce una llave nueva", () => {
    // Y esto es lo correcto: es un vencimiento distinto, no una repetición.
    expect(taskOverdueKey("t1", "2026-09-01")).not.toBe(
      taskOverdueKey("t1", "2026-09-15"),
    );
  });

  it("dos tareas vencidas el mismo día no comparten llave", () => {
    expect(taskOverdueKey("t1", "2026-09-01")).not.toBe(
      taskOverdueKey("t2", "2026-09-01"),
    );
  });

  it("el resumen es uno por día, y el día es lo que lo identifica", () => {
    expect(dueSummaryKey("2026-09-08")).toBe(dueSummaryKey("2026-09-08"));
    expect(dueSummaryKey("2026-09-08")).not.toBe(dueSummaryKey("2026-09-09"));
  });

  it("una asignación se identifica por tarea y destinatario", () => {
    expect(taskAssignedKey("t1", "u1")).toBe(taskAssignedKey("t1", "u1"));
    expect(taskAssignedKey("t1", "u1")).not.toBe(taskAssignedKey("t1", "u2"));
  });

  it("volver a entrar en revisión en otro estado es un hecho nuevo", () => {
    expect(taskReviewKey("t1", "s1")).not.toBe(taskReviewKey("t1", "s2"));
  });

  it("un estancamiento se identifica por cuándo se quedó parada", () => {
    const parada = "2026-09-01T10:00:00.000Z";

    expect(taskStalledKey("t1", parada)).toBe(taskStalledKey("t1", parada));
    expect(taskStalledKey("t1", parada)).not.toBe(
      taskStalledKey("t1", "2026-09-05T10:00:00.000Z"),
    );
  });

  it("ninguna llave salvo la del resumen lleva la fecha de la pasada", () => {
    // La comprobación estructural de la regla: si alguna otra llave llevara el
    // día de ejecución, el trabajo generaría un aviso diario por cada hecho
    // abierto, que es exactamente el ruido que este cambio evita.
    const claves = [
      taskAssignedKey("t1", "u1"),
      taskReviewKey("t1", "s1"),
      taskOverdueKey("t1", "2026-09-01"),
      taskStalledKey("t1", "2026-09-01T10:00:00.000Z"),
    ];

    for (const clave of claves) {
      expect(clave).not.toContain("2026-09-08");
    }
  });
});
