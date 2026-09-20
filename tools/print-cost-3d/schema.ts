import { z } from "zod";

import { validateCurve } from "@/tools/print-cost-3d/margin-curve";

/**
 * KAM-27 · Los tres esquemas de la calculadora de impresión 3D (spec
 * `print-cost-3d` → *Parámetros del taller*, *Entradas del cálculo*).
 *
 * - `configSchema`: las tarifas del taller. Lo **único** que se guarda.
 * - `inputSchema`: lo que se escribe en cada cálculo. Nunca se guarda.
 * - `outputSchema`: lo que se devuelve. Nunca se guarda (convención nº 4).
 *
 * Todo campo de `configSchema` lleva `.default()`: unos parámetros guardados
 * por una versión anterior se completan al leerlos en vez de romper la página.
 * Los valores por defecto son los de la hoja de cálculo del taller de origen.
 *
 * Los porcentajes se guardan como fracción (0,15 = 15 %) y los márgenes como
 * multiplicador (2,5 = 250 %); el formulario los muestra ×100.
 */

const money = (label: string, extra: { help?: string; unit?: string } = {}) => ({
  label,
  kind: "money" as const,
  ...extra,
});
const percent = (label: string, extra: { help?: string } = {}) => ({
  label,
  kind: "percent" as const,
  ...extra,
});

const amount = z.number("Escribe un número").finite().min(0, "No puede ser negativo");

export const DEFAULT_MARGIN_CURVE = [
  { cost: 10, margin: 2.5 },
  { cost: 50, margin: 1.75 },
  { cost: 70, margin: 1.57 },
  { cost: 80, margin: 1.5 },
];

export const ROUNDING_OPTIONS = ["none", "half", "unit"] as const;

/** Rótulos de las opciones de redondeo, para el formulario y la página. */
export const ROUNDING_LABELS: Record<(typeof ROUNDING_OPTIONS)[number], string> = {
  none: "Sin redondeo",
  half: "A 0,50",
  unit: "A la unidad",
};

export const configSchema = z
  .object({
    filamentPricePerKg: amount
      .default(175)
      .meta(money("Precio del filamento", { unit: "por kilo" })),
    machineCostPerHour: amount.default(2.75).meta(
      money("Costo de máquina", {
        unit: "por hora",
        help: "Incluye la luz y el desgaste de la impresora.",
      }),
    ),
    colorSurcharge: amount.default(0.15).meta(
      percent("Recargo por color adicional", {
        help: "Cada color después del primero encarece la impresión: purgas y cambios de filamento.",
      }),
    ),
    assemblyCost: amount
      .default(0.5)
      .meta(money("Costo de un armado", { help: "Entra en el costo y lleva margen." })),
    extras: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Ponle un nombre").meta({ label: "Nombre" }),
          cost: amount.meta(money("Costo unitario")),
        }),
      )
      .default([])
      .meta({
        label: "Insumos extra",
        help: "Argollas, cadenas, clickers… Se suman al precio a su costo, sin margen.",
      }),
    failureRate: amount.max(1, "No puede pasar de 100 %").default(0).meta(
      percent("Fondo de fallos", {
        help: "Porcentaje del costo que se reserva para impresiones fallidas.",
      }),
    ),
    marginCurve: z
      .array(
        z.object({
          cost: z
            .number("Escribe un número")
            .finite()
            .meta(money("Si producirla cuesta")),
          margin: z.number("Escribe un número").finite().meta(percent("se vende al")),
        }),
      )
      .default(DEFAULT_MARGIN_CURVE)
      .meta({
        label: "Curva de margen unitario",
        help:
          "Una pieza barata aguanta más margen que una cara. Entre dos anclas el margen " +
          "se reparte en línea recta; fuera de ellas vale el del extremo. 250 % = el precio es 2,5 veces el costo.",
      }),
    wholesaleRatio: z
      .number("Escribe un número")
      .finite()
      .gt(0, "Tiene que ser mayor que cero")
      .max(1, "El precio por mayor no puede superar al unitario")
      .default(0.8)
      .meta(
        percent("Margen por mayor", {
          help: "Qué parte del margen unitario se cobra por mayor.",
        }),
      ),
    dozenDiscount: amount
      .lt(1, "Tiene que ser menor que 100 %")
      .default(0.05)
      .meta(percent("Descuento por docena", { help: "Sobre el precio por mayor." })),
    rounding: z
      .enum(ROUNDING_OPTIONS)
      .default("unit")
      .meta({
        label: "Redondeo de los precios",
        help: "No afecta al desglose del costo.",
        options: ROUNDING_LABELS,
      }),
  })
  .superRefine((config, context) => {
    const problem = validateCurve(config.marginCurve);
    if (problem) {
      context.addIssue({
        code: "custom",
        message: problem.message,
        path: ["marginCurve", problem.index, problem.reason === "cost" || problem.reason === "order" ? "cost" : "margin"],
      });
    }

    // El nombre es la llave con la que el cálculo pide cantidades.
    const seen = new Set<string>();
    config.extras.forEach((extra, index) => {
      const key = extra.name.toLowerCase();
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Ya hay un insumo con ese nombre",
          path: ["extras", index, "name"],
        });
      }
      seen.add(key);
    });
  });

export type PrintCostConfig = z.infer<typeof configSchema>;

const wholeAtLeastOne = (message: string) =>
  z.number("Escribe un número").int("Tiene que ser un número entero").min(1, message);

export const inputSchema = z.object({
  grams: amount.default(0).meta({ label: "Filamento de la placa", unit: "g" }),
  /** El tiempo va en tres campos porque así lo dice el laminador: 1 d 2 h 30 min. */
  days: amount.default(0).meta({ label: "Días de impresión", unit: "d" }),
  hours: amount.default(0).meta({ label: "Horas de impresión", unit: "h" }),
  minutes: amount.default(0).meta({ label: "Minutos de impresión", unit: "min" }),
  units: wholeAtLeastOne("De la placa tiene que salir al menos una unidad")
    .default(1)
    .meta({ label: "Unidades por placa" }),
  colors: wholeAtLeastOne("Al menos un color").default(1).meta({ label: "Colores" }),
  assemblies: amount.default(0).meta({ label: "Armados por unidad" }),
  /** Cuántos lleva cada unidad de cada insumo configurado, por nombre. */
  extraQuantities: z
    .record(z.string(), amount)
    .default({})
    .meta({ label: "Insumos por unidad" }),
});

export type PrintCostInput = z.infer<typeof inputSchema>;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

/** Los tres campos de tiempo, sumados en minutos: lo que entra en la fórmula. */
export function printMinutes(time: Pick<PrintCostInput, "days" | "hours" | "minutes">): number {
  return time.days * MINUTES_PER_DAY + time.hours * MINUTES_PER_HOUR + time.minutes;
}

export const outputSchema = z.object({
  materialCost: amount,
  machineCost: amount,
  printCostPerUnit: amount,
  assemblyCost: amount,
  failureCost: amount,
  unitCost: amount,
  /** Multiplicador aplicado: 2,5 = 250 %. */
  margin: z.number().min(1),
  extrasCost: amount,
  unitPrice: amount,
  wholesalePrice: amount,
  dozenPrice: amount,
  platePrice: amount,
});

export type PrintCostOutput = z.infer<typeof outputSchema>;

/**
 * Los parámetros de la organización, completados. `null` cuando lo guardado no
 * sirve ni completándolo: la página no calcula y manda a revisar parámetros.
 */
export function readConfig(stored: unknown): PrintCostConfig | null {
  const parsed = configSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : null;
}
