import { fixtures } from "@/tools/print-cost-3d/fixtures";
import { calculate } from "@/tools/print-cost-3d/formula";
import {
  configSchema,
  inputSchema,
  outputSchema,
  type PrintCostConfig,
  type PrintCostInput,
  type PrintCostOutput,
} from "@/tools/print-cost-3d/schema";
import type { ToolManifest } from "@/tools/types";

/**
 * KAM-27 · Calculadora de costo de impresión 3D: la primera herramienta del
 * registro (spec `print-cost-3d`). Qué hace, qué pide y qué devuelve, contado
 * para una persona: `README.md`, junto a este archivo.
 */
export const printCost3d: ToolManifest<PrintCostConfig, PrintCostInput, PrintCostOutput> = {
  slug: "print-cost-3d",
  name: "Calculadora de impresión 3D",
  description:
    "Calcula cuánto cuesta producir una pieza impresa en 3D y sugiere a cuánto venderla, " +
    "con tus tarifas y un margen que baja a medida que sube el costo.",
  // Muestra costos y márgenes, que en Kamay son solo de la dueña.
  minRole: "owner",
  hooks: ["page", "order-detail"],
  capabilities: {
    network: false,
    credentials: false,
    produces: "Una línea libre en el pedido, con la descripción, la cantidad y el precio que confirmes.",
  },
  tables: {
    reads: [{ table: "organization_tools", why: "Las tarifas y la curva de margen de la organización." }],
    writes: [{ table: "order_items", via: "addOrderLine" }],
  },
  configSchema,
  inputSchema,
  outputSchema,
  defaults: configSchema.parse({}),
  fixtures,
  run: calculate,
};
