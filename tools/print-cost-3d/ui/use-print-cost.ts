"use client";

import { useMemo, useState } from "react";

import { calculate } from "@/tools/print-cost-3d/formula";
import {
  inputSchema,
  type PrintCostConfig,
  type PrintCostInput,
  type PrintCostOutput,
} from "@/tools/print-cost-3d/schema";

/**
 * KAM-27 · El estado de un cálculo (spec `print-cost-3d` → *Entradas del
 * cálculo*, *Nada de lo calculado se guarda*).
 *
 * Vive **solo en memoria**: ni almacenamiento del navegador, ni store, ni URL. Al salir
 * de la página el cálculo desaparece, y eso es lo especificado.
 *
 * Los campos son texto para aceptar la coma decimal y un campo a medio
 * escribir. Un campo vacío toma su valor por omisión (uno para unidades y
 * colores, cero para lo demás).
 */
export type PrintCostDraft = {
  grams: string;
  days: string;
  hours: string;
  minutes: string;
  units: string;
  colors: string;
  assemblies: string;
  extras: Record<string, string>;
};

export const EMPTY_DRAFT: PrintCostDraft = {
  grams: "",
  days: "",
  hours: "",
  minutes: "",
  units: "1",
  colors: "1",
  assemblies: "",
  extras: {},
};

function toNumber(text: string): number | undefined {
  const clean = text.trim().replace(",", ".");
  return clean === "" ? undefined : Number(clean);
}

export type PrintCostState = {
  draft: PrintCostDraft;
  setField: (name: Exclude<keyof PrintCostDraft, "extras">, value: string) => void;
  setExtra: (name: string, value: string) => void;
  /** Mensaje por campo; los insumos van como `extras.<nombre>`. */
  errors: Record<string, string>;
  input: PrintCostInput | null;
  /** `null` mientras alguna entrada no sea válida: no se muestra nada a medias. */
  result: PrintCostOutput | null;
  /** ¿Se escribió algo? Antes de eso no se enseñan ceros como si fueran un resultado. */
  touched: boolean;
};

export function usePrintCost(config: PrintCostConfig): PrintCostState {
  const [draft, setDraft] = useState<PrintCostDraft>(EMPTY_DRAFT);

  const { input, errors } = useMemo(() => {
    const parsed = inputSchema.safeParse({
      grams: toNumber(draft.grams),
      days: toNumber(draft.days),
      hours: toNumber(draft.hours),
      minutes: toNumber(draft.minutes),
      units: toNumber(draft.units),
      colors: toNumber(draft.colors),
      assemblies: toNumber(draft.assemblies),
      extraQuantities: Object.fromEntries(
        Object.entries(draft.extras).flatMap(([name, text]) => {
          const value = toNumber(text);
          return value === undefined ? [] : [[name, value]];
        }),
      ),
    });
    if (parsed.success) return { input: parsed.data, errors: {} as Record<string, string> };

    const byField: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const [head, name] = issue.path;
      const key = head === "extraQuantities" ? `extras.${String(name)}` : String(head);
      if (!(key in byField)) byField[key] = issue.message;
    }
    return { input: null, errors: byField };
  }, [draft]);

  const result = useMemo(() => (input ? calculate(config, input) : null), [config, input]);

  const touched =
    draft.grams !== "" ||
    draft.days !== "" ||
    draft.hours !== "" ||
    draft.minutes !== "" ||
    draft.assemblies !== "" ||
    Object.values(draft.extras).some((value) => value !== "");

  return {
    draft,
    setField: (name, value) => setDraft((current) => ({ ...current, [name]: value })),
    setExtra: (name, value) =>
      setDraft((current) => ({ ...current, extras: { ...current.extras, [name]: value } })),
    errors,
    input,
    result,
    touched,
  };
}
