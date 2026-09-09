"use client";

import { useMemo, useState, useTransition } from "react";

import { updateAllocationRule } from "@/actions/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AllocationSettingsInput } from "@/lib/reports/allocation-schema";
import type { AllocationRule, BusinessLine } from "@/types";

const OPTIONS: { value: AllocationRule; label: string; hint: string }[] = [
  {
    value: "revenue",
    label: "Proporcional a los ingresos",
    hint: "Cada línea absorbe la parte que representan sus ingresos del periodo.",
  },
  {
    value: "equal",
    label: "Partes iguales",
    hint: "El gasto se divide entre las líneas activas, hayan movido o no.",
  },
  {
    value: "manual",
    label: "Manual",
    hint: "Tú declaras el porcentaje de cada línea. Deben sumar 100 %.",
  },
];

/**
 * Sección *Reparto de gastos compartidos* de V15 (KAM-20).
 *
 * El aviso de línea sin porcentaje **no bloquea** el guardado ni el alta de
 * líneas: el reparto trata esa línea como 0 y sigue funcionando. Bloquear
 * castigaría a quien está montando su negocio por una configuración que quizá
 * no usa.
 */
export function AllocationRuleForm({
  lines,
  settings,
}: {
  /** Solo las no compartidas: la línea General es la que se reparte. */
  lines: BusinessLine[];
  settings: AllocationSettingsInput;
}) {
  const [rule, setRule] = useState<AllocationRule>(settings.rule);
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((line) => [
        line.id,
        String(settings.shares?.[line.id] ?? ""),
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = useMemo(
    () =>
      Object.values(shares).reduce(
        (sum, value) => sum + (Number(value) || 0),
        0,
      ),
    [shares],
  );

  const missing = useMemo(
    () => lines.filter((line) => !shares[line.id]?.trim()),
    [lines, shares],
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const payload: AllocationSettingsInput =
      rule === "manual"
        ? {
            rule,
            shares: Object.fromEntries(
              lines.map((line) => [line.id, Number(shares[line.id]) || 0]),
            ),
          }
        : { rule };

    startTransition(async () => {
      const result = await updateAllocationRule(payload);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Regla de reparto</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex gap-2 rounded-md border p-3 text-sm has-checked:border-foreground"
          >
            <input
              type="radio"
              name="rule"
              value={option.value}
              checked={rule === option.value}
              onChange={() => setRule(option.value)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {rule === "manual" && (
        <div className="space-y-3">
          {lines.map((line) => (
            <div key={line.id} className="space-y-1.5">
              <Label htmlFor={`share-${line.id}`}>{line.name}</Label>
              <Input
                id={`share-${line.id}`}
                inputMode="decimal"
                value={shares[line.id] ?? ""}
                onChange={(event) =>
                  setShares((current) => ({
                    ...current,
                    [line.id]: event.target.value,
                  }))
                }
                aria-describedby="share-total"
              />
            </div>
          ))}

          <p id="share-total" className="text-sm text-muted-foreground">
            Suman {total.toFixed(2).replace(/\.00$/, "")} % de 100 %.
          </p>

          {missing.length > 0 && (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-500">
              {missing.length === 1
                ? `La línea ${missing[0].name} no tiene porcentaje asignado: no recibirá nada del reparto.`
                : `${missing.length} líneas no tienen porcentaje asignado: no recibirán nada del reparto.`}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {saved && <span className="text-sm text-muted-foreground">Guardado.</span>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
