import { describe, expect, it } from "vitest";

import {
  EXPORT_HEADERS,
  MAX_EXPORT_ROWS,
  activityExportFilename,
  exportPeriodLabel,
  fitsExport,
} from "@/lib/activity/export";
import { toCsv } from "@/lib/reports/csv";

/**
 * KAM-22 · El techo y el nombre de la exportación de la bitácora.
 *
 * Escenarios de `activity-screen` § El resultado filtrado se exporta →
 * «Un resultado por encima del techo se avisa».
 *
 * «Un valor con separadores no rompe el archivo» **no se reescribe aquí**: lo
 * cubre `lib/reports/csv.test.ts` sobre el mismo `toCsv()` que esta
 * exportación usa (design D6). La última prueba de este archivo comprueba que
 * ese caso sigue en pie sobre datos de bitácora, para que reutilizar no sea
 * confiar a ciegas.
 */
describe("el techo de la exportación", () => {
  // Escenario: Un resultado por encima del techo se avisa
  it("cabe hasta el tope y no una fila más", () => {
    expect(fitsExport(MAX_EXPORT_ROWS)).toBe(true);
    expect(fitsExport(MAX_EXPORT_ROWS + 1)).toBe(false);
  });

  it("una bitácora vacía cabe", () => {
    expect(fitsExport(0)).toBe(true);
  });
});

describe("el nombre del archivo", () => {
  it("lleva el rango cuando lo hay", () => {
    expect(
      activityExportFilename({ from: "2026-08-17", to: "2026-08-19" }),
    ).toBe("bitacora-2026-08-17_2026-08-19.csv");
  });

  it("distingue un rango abierto por cada lado", () => {
    expect(activityExportFilename({ from: "2026-08-17", to: null })).toBe(
      "bitacora-desde-2026-08-17.csv",
    );
    expect(activityExportFilename({ from: null, to: "2026-08-19" })).toBe(
      "bitacora-hasta-2026-08-19.csv",
    );
  });

  it("sin rango dice que es todo", () => {
    expect(activityExportFilename({ from: null, to: null })).toBe(
      "bitacora-completa.csv",
    );
    expect(exportPeriodLabel({ from: null, to: null })).toBe(
      "Toda la bitácora",
    );
  });
});

describe("el archivo se abre bien con datos de bitácora", () => {
  // Escenario: El archivo es legible
  it("trae el contexto y las siete columnas", () => {
    const csv = toCsv(
      {
        title: "Bitácora de actividad",
        period: exportPeriodLabel({ from: "2026-08-17", to: "2026-08-19" }),
        line: "Todas",
      },
      { headers: [...EXPORT_HEADERS], rows: [] },
    );

    expect(csv).toContain("Bitácora de actividad");
    expect(csv).toContain("2026-08-17 a 2026-08-19");
    expect(csv).toContain("Qué pasó");
  });

  // Escenario: Un valor con separadores no rompe el archivo
  // El caso vive en lib/reports/csv.test.ts; aquí se comprueba sobre una frase
  // de bitácora real, que es donde las comas abundan.
  it("una frase con comas y comillas queda en una sola celda", () => {
    const sentence =
      'Marcela editó el contacto «Papeles, S.A.», que se llamaba "Papeles"';

    const csv = toCsv(
      { title: "Bitácora", period: "Todo", line: "Todas" },
      {
        headers: [...EXPORT_HEADERS],
        rows: [["2026-08-19", "Marcela", sentence, "CONTACTO", "General", "escritorio", "—"]],
      },
    );

    const dataLine = csv.trimEnd().split("\r\n").at(-1)!;
    expect(dataLine).toContain('"Marcela editó el contacto «Papeles, S.A.», que se llamaba ""Papeles"""');
    // Siete columnas: seis separadores fuera de las comillas.
    expect(dataLine.replace(/"[^"]*(?:""[^"]*)*"/g, "")).toBe(
      "2026-08-19,Marcela,,CONTACTO,General,escritorio,—",
    );
  });
});
