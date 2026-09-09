import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRESET,
  InvalidPeriodError,
  rangeForPreset,
  resolveReportPeriod,
} from "./period";

const LA_PAZ = "America/La_Paz"; // UTC−4, sin horario de verano.

describe("rangeForPreset", () => {
  it("this-month cubre el mes civil completo", () => {
    expect(rangeForPreset("this-month", "2026-03-12")).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  it("last-month cruza el cambio de año hacia atrás", () => {
    expect(rangeForPreset("last-month", "2026-01-09")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("last-3-months incluye el mes en curso", () => {
    expect(rangeForPreset("last-3-months", "2026-03-12")).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("this-year cubre el año civil", () => {
    expect(rangeForPreset("this-year", "2026-03-12")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });

  it("febrero de un año bisiesto termina el 29", () => {
    expect(rangeForPreset("this-month", "2028-02-10").to).toBe("2028-02-29");
  });
});

describe("resolveReportPeriod", () => {
  // Requisito «Un solo periodo gobierna los cinco informes»
  // → escenario «El corte respeta la zona horaria de la organización».
  it("corta el periodo en la zona de la organización, no en UTC", () => {
    const period = resolveReportPeriod(
      { preset: "this-month" },
      "2026-03-12",
      LA_PAZ,
    );

    // Marzo empieza a las 00:00 de La Paz, que en UTC es el 1 a las 04:00.
    expect(period.fromInstant).toBe("2026-03-01T04:00:00.000Z");
    // El límite superior es exclusivo: el inicio del 1 de abril en La Paz.
    expect(period.toInstant).toBe("2026-04-01T04:00:00.000Z");
  });

  it("un cobro de las 21:00 del último día pertenece al mes que termina", () => {
    const period = resolveReportPeriod(
      { preset: "this-month" },
      "2026-03-12",
      LA_PAZ,
    );

    // 31 de marzo, 21:00 en La Paz = 1 de abril, 01:00 UTC. En UTC ya es
    // abril; para el taller sigue siendo marzo, y el rango tiene que incluirlo.
    const cobro = "2026-04-01T01:00:00.000Z";
    expect(cobro >= period.fromInstant).toBe(true);
    expect(cobro < period.toInstant).toBe(true);
  });

  // Requisito «Un solo periodo gobierna los cinco informes»
  // → escenario «Rango invertido».
  it("rechaza un rango cuyo fin es anterior a su inicio", () => {
    expect(() =>
      resolveReportPeriod(
        { preset: "custom", from: "2026-04-20", to: "2026-03-12" },
        "2026-05-01",
        LA_PAZ,
      ),
    ).toThrow(InvalidPeriodError);
  });

  it("acepta un rango libre que no empieza el día 1", () => {
    const period = resolveReportPeriod(
      { preset: "custom", from: "2026-03-12", to: "2026-04-20" },
      "2026-05-01",
      LA_PAZ,
    );

    expect(period.from).toBe("2026-03-12");
    expect(period.to).toBe("2026-04-20");
    expect(period.preset).toBe("custom");
  });

  it("un rango libre incompleto cae en el mes en curso", () => {
    const period = resolveReportPeriod(
      { preset: "custom", from: "2026-03-12" },
      "2026-05-04",
      LA_PAZ,
    );

    expect(period.from).toBe("2026-05-01");
    expect(period.preset).toBe(DEFAULT_PRESET);
  });

  it("un atajo desconocido cae en el mes en curso", () => {
    const period = resolveReportPeriod(
      { preset: "el-trimestre-que-viene" },
      "2026-05-04",
      LA_PAZ,
    );

    expect(period.preset).toBe(DEFAULT_PRESET);
    expect(period.from).toBe("2026-05-01");
  });

  // El presupuesto del criterio 8 se mide sobre doce meses; el atajo tiene
  // que poder pedirlos.
  it("un rango de doce meses se resuelve entero", () => {
    const period = resolveReportPeriod(
      { preset: "custom", from: "2025-05-01", to: "2026-04-30" },
      "2026-05-04",
      LA_PAZ,
    );

    expect(period.fromInstant).toBe("2025-05-01T04:00:00.000Z");
    expect(period.toInstant).toBe("2026-05-01T04:00:00.000Z");
  });
});
