import { marginAt } from "@/tools/print-cost-3d/margin-curve";
import {
  printMinutes,
  type PrintCostConfig,
  type PrintCostInput,
  type PrintCostOutput,
} from "@/tools/print-cost-3d/schema";

/**
 * KAM-27 · La fórmula de la calculadora de impresión 3D (spec `print-cost-3d`
 * → *Costo de producción por unidad* y *Precios sugeridos*; design D8).
 *
 * Pura: sin React, sin fechas, sin E/S. Portada de la hoja de cálculo del
 * taller, con cada tarifa que allí estaba escrita dentro de la fórmula
 * convertida en parámetro. Con los parámetros por defecto el **costo**
 * coincide con el de la hoja al centavo (`fixtures.ts`).
 *
 * Dos decisiones heredadas de la hoja, a propósito:
 * - el **armado** entra en el costo y por eso lleva margen;
 * - los **insumos** se suman después del margen, a su costo.
 */

const ROUNDING_STEP = { none: 0, half: 0.5, unit: 1 } as const;

/** Redondeo comercial al paso configurado. Solo para precios, nunca para el costo. */
export function roundPrice(price: number, rounding: PrintCostConfig["rounding"]): number {
  const step = ROUNDING_STEP[rounding];
  if (step === 0) return price;
  // El épsilon evita que 3,5 / 0,5 = 6,999999… redondee hacia abajo.
  return Math.round(price / step + 1e-9) * step;
}

export function calculate(config: PrintCostConfig, input: PrintCostInput): PrintCostOutput {
  const materialCost = (input.grams * config.filamentPricePerKg) / 1000;
  const machineCost = (printMinutes(input) * config.machineCostPerHour) / 60;

  // Algebraicamente igual a `0,85 + 0,15 × colores` de la hoja, con un solo
  // parámetro que significa algo: cuánto encarece cada color adicional.
  const colorFactor = 1 + config.colorSurcharge * (input.colors - 1);
  const printCostPerUnit = ((materialCost + machineCost) / input.units) * colorFactor;

  const assemblyCost = input.assemblies * config.assemblyCost;
  const failureCost = (printCostPerUnit + assemblyCost) * config.failureRate;
  const unitCost = printCostPerUnit + assemblyCost + failureCost;

  const margin = marginAt(config.marginCurve, unitCost);

  // Un insumo que la organización ya quitó de sus parámetros no cuenta.
  const extrasCost = config.extras.reduce(
    (total, extra) => total + (input.extraQuantities[extra.name] ?? 0) * extra.cost,
    0,
  );

  // Cada precio sale de valores sin redondear: redondear el unitario y
  // multiplicarlo por doce arrastraría el error doce veces.
  const unitPrice = unitCost * margin + extrasCost;
  const wholesalePrice = unitCost * margin * config.wholesaleRatio + extrasCost;
  const dozenPrice = wholesalePrice * (1 - config.dozenDiscount) * 12;
  const platePrice = wholesalePrice * input.units;

  return {
    materialCost,
    machineCost,
    printCostPerUnit,
    assemblyCost,
    failureCost,
    unitCost,
    margin,
    extrasCost,
    unitPrice: roundPrice(unitPrice, config.rounding),
    wholesalePrice: roundPrice(wholesalePrice, config.rounding),
    dozenPrice: roundPrice(dozenPrice, config.rounding),
    platePrice: roundPrice(platePrice, config.rounding),
  };
}
