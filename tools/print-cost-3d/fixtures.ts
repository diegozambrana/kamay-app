import type { ToolFixture } from "@/tools/types";
import { configSchema, type PrintCostConfig, type PrintCostInput } from "@/tools/print-cost-3d/schema";

/**
 * KAM-27 · Casos de referencia: filas **reales** de la hoja «Calculadora 3D»
 * con la que el taller cotizaba antes de que existiera esta herramienta.
 *
 * Son la red de seguridad de la fórmula: si alguien la toca y el costo del
 * Cat Skull deja de ser 10,594375, la prueba lo dice.
 *
 * La hoja usaba un margen fijo (×2,5 unidad, ×2 por mayor) y no redondeaba.
 * `SPREADSHEET_CONFIG` reproduce eso exactamente —curva de una sola ancla,
 * proporción 80 %, sin redondeo— para poder comparar también los precios. El
 * **costo** no depende de la curva y coincide con cualquier configuración que
 * conserve las tarifas por defecto.
 */
export const SPREADSHEET_CONFIG: PrintCostConfig = configSchema.parse({
  extras: [
    { name: "Llavero", cost: 0.5 },
    { name: "Clicker", cost: 3 },
  ],
  marginCurve: [{ cost: 10, margin: 2.5 }],
  wholesaleRatio: 0.8,
  dozenDiscount: 0.05,
  rounding: "none",
});

export type SpreadsheetRow = ToolFixture<PrintCostInput> & {
  /** Columnas M, O, N y P de la hoja. */
  expected: { unitCost: number; unitPrice: number; wholesalePrice: number; dozenPrice: number };
};

function row(
  name: string,
  [grams, minutes, units, colors, keyrings, assemblies, clickers]: number[],
  [unitCost, wholesalePrice, unitPrice, dozenPrice]: number[],
): SpreadsheetRow {
  return {
    name,
    input: {
      grams,
      // La hoja anotaba el tiempo en minutos, sin días ni horas.
      days: 0,
      hours: 0,
      minutes,
      units,
      colors,
      assemblies,
      extraQuantities: { Llavero: keyrings, Clicker: clickers },
    },
    expected: { unitCost, unitPrice, wholesalePrice, dozenPrice },
  };
}

//            nombre               g    min  u  AMS llav arm click   costo (M)     mayor (N)     unidad (O)    docena (P)
export const SPREADSHEET_ROWS: readonly SpreadsheetRow[] = [
  row("Cat Skull",             [143,  660,  6, 2, 1,  0, 0], [10.594375,    21.68875,     26.9859375,   247.25175]),
  row("Box ataúd",             [175,  420,  1, 1, 0,  0, 0], [49.875,       99.75,        124.6875,     1137.15]),
  row("Araña bicolor",         [115,  560, 12, 3, 1,  1, 0], [5.460763889,  11.42152778,  14.15190972,  130.2054167]),
  row("Llaveros Bandas 3",     [76,   227, 20, 3, 1,  0, 0], [1.540770833,  3.581541667,  4.351927083,  40.829575]),
  row("Skull Clicker",         [175,  484,  9, 2, 0,  1, 1], [7.247731481,  17.49546296,  21.1193287,   199.4482778]),
  row("Cat plate",             [240,  700,  1, 1, 0,  0, 0], [74.08333333,  148.1666667,  185.2083333,  1689.1]),
  row("Llavero Heart",         [52,   200, 16, 1, 1,  0, 0], [1.141666667,  2.783333333,  3.354166667,  31.73]),
  row("Mimic Chest",           [271, 2049, 16, 1, 0, 10, 0], [13.83359375,  27.6671875,   34.58398438,  315.4059375]),
];

/** Lo que el contrato de herramientas recorre: solo nombre y entradas. */
export const fixtures: readonly ToolFixture<PrintCostInput>[] = SPREADSHEET_ROWS.map(
  ({ name, input }) => ({ name, input }),
);
