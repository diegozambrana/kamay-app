"use client";

import { readConfig } from "@/tools/print-cost-3d/schema";
import { CalculatorForm, InvalidConfigNotice } from "@/tools/print-cost-3d/ui/calculator-form";
import { usePrintCost } from "@/tools/print-cost-3d/ui/use-print-cost";
import type { PrintCostConfig } from "@/tools/print-cost-3d/schema";

/**
 * KAM-27 · La página de la calculadora, en `/extensions/print-cost-3d` (spec
 * `print-cost-3d` → *La página de la calculadora*).
 *
 * Recibe los parámetros **como dato**: quién los lee y con qué permisos es
 * cosa del núcleo. Y no importa ninguna acción: en esta página un cálculo no
 * puede dejar rastro en la base, ni queriendo.
 */
function Calculator({ config, currency }: { config: PrintCostConfig; currency: string }) {
  const state = usePrintCost(config);
  return <CalculatorForm config={config} currency={currency} state={state} />;
}

export function PrintCostPage({ config, currency }: { config: unknown; currency: string }) {
  const parsed = readConfig(config);
  if (!parsed) return <InvalidConfigNotice />;
  return <Calculator config={parsed} currency={currency} />;
}
