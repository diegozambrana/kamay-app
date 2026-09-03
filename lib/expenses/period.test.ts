import { describe, expect, it } from "vitest";

import {
  currentMonthRange,
  isCivilDate,
  resolvePeriod,
  startOfDayInTimezone,
  startOfNextDayInTimezone,
} from "./period";

describe("currentMonthRange", () => {
  it("va del 1 al último día del mes de hoy", () => {
    expect(currentMonthRange("2026-09-03")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("conoce febrero bisiesto", () => {
    expect(currentMonthRange("2028-02-10").to).toBe("2028-02-29");
    expect(currentMonthRange("2026-02-10").to).toBe("2026-02-28");
  });

  it("diciembre cierra el 31 sin pasar de año", () => {
    expect(currentMonthRange("2026-12-15")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("resolvePeriod", () => {
  it("respeta un periodo válido de la dirección", () => {
    expect(resolvePeriod("2026-08-01", "2026-08-15", "2026-09-03")).toEqual({
      from: "2026-08-01",
      to: "2026-08-15",
    });
  });

  it("cae al mes en curso cuando faltan o vienen mal formados", () => {
    expect(resolvePeriod(undefined, undefined, "2026-09-03")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(resolvePeriod("ayer", "2026-09-10", "2026-09-03")).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
    });
  });
});

describe("isCivilDate", () => {
  it("acepta YYYY-MM-DD y nada más", () => {
    expect(isCivilDate("2026-09-03")).toBe(true);
    expect(isCivilDate("2026-9-3")).toBe(false);
    expect(isCivilDate("2026-09-03T00:00")).toBe(false);
    expect(isCivilDate(null)).toBe(false);
  });
});

describe("startOfDayInTimezone", () => {
  it("La Paz (UTC-4): el día empieza a las 04:00 UTC", () => {
    expect(startOfDayInTimezone("2026-09-01", "America/La_Paz")).toBe(
      "2026-09-01T04:00:00.000Z",
    );
  });

  it("en UTC no hay desfase", () => {
    expect(startOfDayInTimezone("2026-09-01", "UTC")).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("el día siguiente es el límite exclusivo del periodo", () => {
    expect(startOfNextDayInTimezone("2026-09-30", "America/La_Paz")).toBe(
      "2026-10-01T04:00:00.000Z",
    );
  });
});

describe("occurredAtForDate", () => {
  it("hoy es la hora real de ahora", async () => {
    const { occurredAtForDate } = await import("./period");
    const now = new Date("2026-09-03T15:04:05.000Z");
    expect(occurredAtForDate("2026-09-03", "2026-09-03", now)).toBe(
      "2026-09-03T15:04:05.000Z",
    );
  });

  it("otro día cae a su mediodía local, lejos de los bordes", async () => {
    const { occurredAtForDate } = await import("./period");
    const result = new Date(occurredAtForDate("2026-08-15", "2026-09-03"));
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(12);
  });
});
