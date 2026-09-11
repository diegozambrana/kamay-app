import { describe, expect, it } from "vitest";

import {
  civilDayOf,
  dayLabel,
  groupByDay,
  longDate,
  timeOf,
} from "@/lib/activity/grouping";

const LA_PAZ = "America/La_Paz"; // UTC−4, sin horario de verano.

/**
 * KAM-22 · El agrupado por día de V23.
 *
 * Escenarios de `activity-screen` § Los eventos se listan del más reciente al
 * más antiguo, agrupados por día → «Orden inverso por día», «El conteo del día
 * es el de sus eventos», «El orden no baila entre recargas».
 *
 * En el servidor y en la zona de la organización: agrupar en el navegador
 * pondría cada evento en el día de quien mira, y el mismo evento caería en
 * «Hoy» o en «Ayer» según desde dónde se abriera la pantalla.
 */
describe("civilDayOf", () => {
  it("usa la zona de la organización, no la del proceso", () => {
    // Las 02:00 UTC del 20 son todavía el 19 en La Paz.
    expect(civilDayOf("2026-08-20T02:00:00.000Z", LA_PAZ)).toBe("2026-08-19");
    expect(civilDayOf("2026-08-20T02:00:00.000Z", "UTC")).toBe("2026-08-20");
  });

  it("el borde del día cae donde la organización lo pone", () => {
    expect(civilDayOf("2026-08-20T03:59:59.000Z", LA_PAZ)).toBe("2026-08-19");
    expect(civilDayOf("2026-08-20T04:00:00.000Z", LA_PAZ)).toBe("2026-08-20");
  });
});

describe("timeOf", () => {
  it("da la hora local en veinticuatro horas", () => {
    expect(timeOf("2026-08-19T18:22:00.000Z", LA_PAZ)).toBe("14:22");
  });

  it("la medianoche es 00, no 24", () => {
    expect(timeOf("2026-08-20T04:00:00.000Z", LA_PAZ)).toBe("00:00");
  });
});

describe("dayLabel", () => {
  const HOY = "2026-08-19";

  it("nombra hoy y ayer", () => {
    expect(dayLabel("2026-08-19", HOY)).toBe("Hoy");
    expect(dayLabel("2026-08-18", HOY)).toBe("Ayer");
  });

  it("dentro de la semana usa el día de la semana", () => {
    expect(dayLabel("2026-08-17", HOY)).toBe("Lunes");
  });

  // Más allá de una semana «martes» a secas puede ser cualquiera de los
  // últimos años, y deja de orientar.
  it("más allá de una semana usa la fecha completa", () => {
    expect(dayLabel("2026-07-04", HOY)).toContain("julio");
    expect(dayLabel("2026-07-04", HOY)).not.toBe("Sábado");
  });

  it("la fecha larga lleva día de la semana, número y mes", () => {
    const larga = longDate("2026-08-19");
    expect(larga).toContain("19");
    expect(larga).toContain("agosto");
  });
});

describe("groupByDay", () => {
  const evento = (occurredAt: string, id: number) => ({ occurredAt, id });

  // Escenario: Orden inverso por día
  it("agrupa sin reordenar, respetando el orden que trae la consulta", () => {
    const dias = groupByDay(
      [
        evento("2026-08-19T18:00:00.000Z", 3),
        evento("2026-08-19T14:00:00.000Z", 2),
        evento("2026-08-18T14:00:00.000Z", 1),
      ],
      LA_PAZ,
    );

    expect(dias.map((d) => d.day)).toEqual(["2026-08-19", "2026-08-18"]);
    expect(dias[0].items.map((i) => i.id)).toEqual([3, 2]);
  });

  // Escenario: El conteo del día es el de sus eventos
  it("cada día se queda con los suyos", () => {
    const dias = groupByDay(
      [
        evento("2026-08-19T18:00:00.000Z", 4),
        evento("2026-08-19T17:00:00.000Z", 3),
        evento("2026-08-19T16:00:00.000Z", 2),
        evento("2026-08-18T16:00:00.000Z", 1),
      ],
      LA_PAZ,
    );

    expect(dias.map((d) => d.items.length)).toEqual([3, 1]);
  });

  // Escenario: El orden no baila entre recargas
  //
  // La consulta ordena por `occurred_at desc, id desc`; si este agrupado
  // reordenara, ese desempate estable se perdería justo aquí.
  it("dos eventos del mismo instante conservan el orden de entrada", () => {
    const mismo = "2026-08-19T18:00:00.000Z";
    const dias = groupByDay([evento(mismo, 9), evento(mismo, 8)], LA_PAZ);

    expect(dias[0].items.map((i) => i.id)).toEqual([9, 8]);
  });

  it("un día que reaparece más abajo abre otro grupo, no se fusiona", () => {
    // No debería ocurrir con la lista ordenada, pero si ocurriera, fusionar
    // significaría mover un evento fuera de su sitio en la lista.
    const dias = groupByDay(
      [
        evento("2026-08-19T18:00:00.000Z", 3),
        evento("2026-08-18T18:00:00.000Z", 2),
        evento("2026-08-19T10:00:00.000Z", 1),
      ],
      LA_PAZ,
    );

    expect(dias.map((d) => d.day)).toEqual([
      "2026-08-19",
      "2026-08-18",
      "2026-08-19",
    ]);
  });

  it("sin eventos no hay días", () => {
    expect(groupByDay([], LA_PAZ)).toEqual([]);
  });
});
