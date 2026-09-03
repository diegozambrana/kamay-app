import { describe, expect, it } from "vitest";

import { formatDateTime } from "./datetime";

const ISO = "2026-08-26T22:00:47.955Z";

describe("formatDateTime", () => {
  it("escribe la hora de la zona pedida, no la del entorno", () => {
    expect(formatDateTime(ISO, "America/La_Paz")).toBe("26/08/2026 18:00");
    expect(formatDateTime(ISO, "UTC")).toBe("26/08/2026 22:00");
  });

  it("la medianoche se escribe 00 y no 24", () => {
    // ICU devuelve "24" para la medianoche con hour12:false: sin este ajuste,
    // el evento de las 00:05 aparecería como 24:05.
    expect(formatDateTime("2026-08-27T04:05:00.000Z", "America/La_Paz")).toBe(
      "27/08/2026 00:05",
    );
  });

  it("es estable: el texto no depende de la versión de ICU del entorno", () => {
    // Es lo que evita que la hidratación descarte el render del servidor:
    // solo hay dígitos y separadores propios, ningún nombre de mes.
    expect(formatDateTime(ISO, "America/La_Paz")).toMatch(
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
    );
  });
});

describe("formatDate", () => {
  it("escribe solo día/mes/año en la zona de la organización", async () => {
    const { formatDate } = await import("./datetime");
    // Las 02:30 UTC del 2 de septiembre son todavía el 1 en La Paz (UTC-4).
    expect(formatDate("2026-09-02T02:30:00.000Z", "America/La_Paz")).toBe("01/09/2026");
    expect(formatDate("2026-09-02T02:30:00.000Z", "UTC")).toBe("02/09/2026");
  });
});
