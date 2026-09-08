import { describe, expect, it } from "vitest";

import { GROUP_KEYS, groupByDue, keyOf, pendingCounts } from "./groups";

/**
 * KAM-17 · Los cuatro grupos de Mis pendientes.
 *
 * Escenarios del delta spec `my-tasks` — requisito "Cuatro grupos por fecha,
 * con contador y en orden fijo": «Los cuatro grupos y su orden», «Lo vencido
 * primero», «El día es el de la organización», «Una tarea sin fecha», «Grupo
 * sin tareas» y «Lo cerrado no vuelve».
 */

const HOY = "2026-09-08";

function task(id: string, dueDate: string | null, closedAt: string | null = null) {
  return { id, dueDate, closedAt };
}

describe("groupByDue", () => {
  it("devuelve los cuatro grupos en su orden fijo", () => {
    const groups = groupByDue([], HOY);

    expect(groups.map((group) => group.key)).toEqual([
      "overdue",
      "today",
      "upcoming",
      "undated",
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Vencidas",
      "Hoy",
      "Próximos 7 días",
      "Sin fecha",
    ]);
  });

  it("reparte cada tarea en su grupo", () => {
    const groups = groupByDue(
      [
        task("vencida", "2026-09-01"),
        task("hoy", HOY),
        task("semana", "2026-09-12"),
        task("sinfecha", null),
      ],
      HOY,
    );

    const ids = Object.fromEntries(
      groups.map((group) => [group.key, group.tasks.map((t) => t.id)]),
    );
    expect(ids).toEqual({
      overdue: ["vencida"],
      today: ["hoy"],
      upcoming: ["semana"],
      undated: ["sinfecha"],
    });
  });

  it("lo vencido va primero", () => {
    const groups = groupByDue([task("hoy", HOY), task("vencida", "2026-09-01")], HOY);

    expect(groups[0].key).toBe("overdue");
    expect(groups[0].tasks[0].id).toBe("vencida");
  });

  it("dentro de vencidas, lo más antiguo primero", () => {
    const groups = groupByDue(
      [task("reciente", "2026-09-06"), task("antigua", "2026-08-01")],
      HOY,
    );

    expect(groups[0].tasks.map((t) => t.id)).toEqual(["antigua", "reciente"]);
  });

  it("una tarea sin fecha va a Sin fecha y a ningún otro grupo", () => {
    const groups = groupByDue([task("t", null)], HOY);

    expect(groups.find((g) => g.key === "undated")!.tasks).toHaveLength(1);
    for (const key of ["overdue", "today", "upcoming"] as const) {
      expect(groups.find((g) => g.key === key)!.tasks).toHaveLength(0);
    }
  });

  it("lo cerrado no vuelve, aunque su fecha haya pasado", () => {
    const groups = groupByDue(
      [task("cerrada", "2026-09-01", "2026-09-02T10:00:00Z")],
      HOY,
    );

    for (const group of groups) {
      expect(group.tasks).toHaveLength(0);
    }
  });

  it("un grupo sin tareas llega vacío, no con un contador inventado", () => {
    const groups = groupByDue([task("t", null)], HOY);

    expect(groups.find((g) => g.key === "overdue")!.tasks).toEqual([]);
  });

  it("una tarea que vence dentro de un mes no aparece en esta pantalla", () => {
    // Tiene fecha, así que no es «Sin fecha»; y no toca todavía, así que no es
    // ninguno de los otros tres. Se ve en el tablero, que es la vista de
    // gestión: V20 contesta «qué hago hoy».
    const groups = groupByDue([task("lejana", "2026-10-20")], HOY);

    for (const group of groups) {
      expect(group.tasks).toHaveLength(0);
    }
  });

  it("el borde de la ventana entra y el día siguiente ya no", () => {
    const dentro = groupByDue([task("t", "2026-09-15")], HOY);
    const fuera = groupByDue([task("t", "2026-09-16")], HOY);

    expect(dentro.find((g) => g.key === "upcoming")!.tasks).toHaveLength(1);
    expect(fuera.every((group) => group.tasks.length === 0)).toBe(true);
  });
});

describe("groupByDue · el día es el de la organización", () => {
  it("la misma tarea cae en un grupo u otro según cuál sea hoy allí", () => {
    // Un taller en La Paz no debe ver una tarea en Vencidas porque el
    // portátil viajó: `today` llega ya resuelto en la zona de la organización.
    const tarea = [task("t", "2026-09-08")];

    expect(keyOf(tarea[0], "2026-09-08")).toBe("today");
    expect(keyOf(tarea[0], "2026-09-09")).toBe("overdue");
    expect(keyOf(tarea[0], "2026-09-07")).toBe("upcoming");
  });
});

describe("pendingCounts", () => {
  it("da los tres conteos de la tarjeta del panel", () => {
    const counts = pendingCounts(
      [
        task("v1", "2026-09-01"),
        task("v2", "2026-09-02"),
        task("h", HOY),
        task("s1", "2026-09-10"),
        task("s2", "2026-09-11"),
        task("s3", "2026-09-12"),
        task("sin", null),
      ],
      HOY,
    );

    expect(counts).toEqual({ overdue: 2, today: 1, upcoming: 3 });
  });

  it("sin nada pendiente da ceros reales", () => {
    expect(pendingCounts([], HOY)).toEqual({
      overdue: 0,
      today: 0,
      upcoming: 0,
    });
  });

  it("cuenta exactamente lo mismo que la pantalla", () => {
    // El motivo de que salga de la misma función: calcularlo por otra vía es
    // la forma segura de que un día deje de coincidir con lo que V20 enseña.
    const tasks = [
      task("v", "2026-09-01"),
      task("h", HOY),
      task("s", "2026-09-12"),
      task("sin", null),
      task("lejana", "2026-11-01"),
    ];

    const groups = groupByDue(tasks, HOY);
    const counts = pendingCounts(tasks, HOY);

    expect(counts.overdue).toBe(groups[0].tasks.length);
    expect(counts.today).toBe(groups[1].tasks.length);
    expect(counts.upcoming).toBe(groups[2].tasks.length);
  });
});

describe("GROUP_KEYS", () => {
  it("son exactamente cuatro", () => {
    expect(GROUP_KEYS).toHaveLength(4);
  });
});
