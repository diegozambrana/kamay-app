import { describe, expect, it } from "vitest";

import { csvFilename, toCsv } from "./csv";

const context = {
  title: "Comparativo entre líneas",
  period: "1 de marzo – 31 de marzo de 2026",
  line: "Todas",
};

describe("toCsv", () => {
  // Escenario «Cifras utilizables».
  it("las cifras salen sin símbolo de moneda y con punto decimal", () => {
    const csv = toCsv(context, {
      headers: ["Línea", "Ingresos"],
      rows: [["Sublimación", 1234.56]],
    });

    expect(csv).toContain("Sublimación,1234.56");
    expect(csv).not.toContain("Bs");
    expect(csv).not.toContain("1.234,56");
  });

  it("cita las comas para que no partan la fila", () => {
    const csv = toCsv(context, {
      headers: ["Proveedor", "Total"],
      rows: [["Papeles, S.A.", 100]],
    });

    expect(csv).toContain('"Papeles, S.A.",100');
  });

  it("duplica las comillas dentro de una celda", () => {
    const csv = toCsv(context, {
      headers: ["Nota"],
      rows: [['Le dijo "urgente"']],
    });

    expect(csv).toContain('"Le dijo ""urgente"""');
  });

  it("cita los saltos de línea en vez de romper el archivo", () => {
    const csv = toCsv(context, {
      headers: ["Nota"],
      rows: [["Primera\nSegunda"]],
    });

    expect(csv).toContain('"Primera\nSegunda"');
  });

  it("conserva los acentos y abre bien en Excel", () => {
    const csv = toCsv(context, {
      headers: ["Línea"],
      rows: [["Sublimación"]],
    });

    // El BOM es lo que evita "SublimaciÃ³n".
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Sublimación");
  });

  it("una celda nula sale vacía, no como 'null'", () => {
    const csv = toCsv(context, {
      headers: ["Ítem", "Último costo"],
      rows: [["Papel", null]],
    });

    expect(csv).toContain("Papel,\r\n");
    expect(csv).not.toContain("null");
  });

  // Escenario «El archivo se explica solo».
  it("lleva el periodo y la línea con los que se compuso", () => {
    const csv = toCsv(context, { headers: ["Línea"], rows: [] });

    expect(csv).toContain("Comparativo entre líneas");
    expect(csv).toContain("Periodo,1 de marzo – 31 de marzo de 2026");
    expect(csv).toContain("Línea,Todas");
  });

  // Escenario «Leyenda en la exportación».
  it("cuando el informe reparte, la leyenda viaja en el archivo", () => {
    const csv = toCsv(
      {
        ...context,
        legend:
          "Los gastos de General se repartieron proporcional a los ingresos del periodo.",
      },
      { headers: ["Línea"], rows: [] },
    );

    expect(csv).toContain("Reparto,");
    expect(csv).toContain("proporcional a los ingresos del periodo");
  });

  // Escenario «Un informe sin reparto no lleva leyenda».
  it("un informe que no reparte no lleva fila de reparto", () => {
    const csv = toCsv(context, { headers: ["Ítem"], rows: [] });

    expect(csv).not.toContain("Reparto,");
  });
});

describe("csvFilename", () => {
  it("identifica el informe y el periodo", () => {
    expect(
      csvFilename("rentabilidad", { from: "2026-03-01", to: "2026-03-31" }),
    ).toBe("informe-rentabilidad-2026-03-01_2026-03-31.csv");
  });
});
