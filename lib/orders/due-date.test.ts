import { describe, expect, it } from "vitest";

import { DUE_DATE_SHORTCUTS, shiftDate } from "@/lib/orders/due-date";

describe("shiftDate", () => {
  it("«Hoy» devuelve el mismo día", () => {
    expect(shiftDate("2026-09-03", 0)).toBe("2026-09-03");
  });

  it("«Mañana» es el día siguiente al que dio el servidor", () => {
    expect(shiftDate("2026-09-03", 1)).toBe("2026-09-04");
  });

  it("suma tres días y una semana", () => {
    expect(shiftDate("2026-09-03", 3)).toBe("2026-09-06");
    expect(shiftDate("2026-09-03", 7)).toBe("2026-09-10");
  });

  it("cruza el fin de mes", () => {
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDate("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("cruza el fin de año", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("acierta en año bisiesto", () => {
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDate("2028-02-29", 1)).toBe("2028-03-01");
  });

  /**
   * El caso que motiva la aritmética civil: en la madrugada del cambio de
   * horario de verano un día tiene 23 horas, así que sumar 86.400.000 ms se
   * quedaría en el mismo día. En 2026 Chile adelanta el reloj el 6 de
   * septiembre; el atajo tiene que dar el 7 pase lo que pase.
   */
  it("no se descuadra en un cambio de horario de verano", () => {
    expect(shiftDate("2026-09-06", 1)).toBe("2026-09-07");
    expect(shiftDate("2026-04-05", 1)).toBe("2026-04-06");
  });

  it("no depende de la zona horaria del proceso", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Kiritimati"; // UTC+14
      expect(shiftDate("2026-09-03", 1)).toBe("2026-09-04");
      process.env.TZ = "Pacific/Niue"; // UTC−11
      expect(shiftDate("2026-09-03", 1)).toBe("2026-09-04");
    } finally {
      process.env.TZ = original;
    }
  });

  it("rechaza lo que no es una fecha civil", () => {
    expect(() => shiftDate("mañana", 1)).toThrow();
    expect(() => shiftDate("2026-09-03T10:00:00Z", 1)).toThrow();
  });
});

describe("DUE_DATE_SHORTCUTS", () => {
  it("ofrece los cuatro atajos de V5 en orden", () => {
    expect(DUE_DATE_SHORTCUTS.map((shortcut) => shortcut.label)).toEqual([
      "Hoy",
      "Mañana",
      "En 3 días",
      "En una semana",
    ]);
    expect(DUE_DATE_SHORTCUTS.map((shortcut) => shortcut.days)).toEqual([0, 1, 3, 7]);
  });
});
