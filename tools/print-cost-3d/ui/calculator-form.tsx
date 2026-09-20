"use client";

import Link from "next/link";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { printMinutes, type PrintCostConfig } from "@/tools/print-cost-3d/schema";
import { marginPercent, minutesLabel, money } from "@/tools/print-cost-3d/ui/format";
import type { PrintCostState } from "@/tools/print-cost-3d/ui/use-print-cost";

/**
 * KAM-27 · Las entradas y el resultado de la calculadora (spec `print-cost-3d`
 * → *La página de la calculadora*). Lo comparten la página propia y el diálogo
 * del pedido, que le ponen alrededor lo que cada uno necesita.
 *
 * Recalcula al escribir: no hay botón «Calcular» ni formulario que enviar.
 */
const PARAMS_HREF = "/settings/tools";

type Field = {
  name: "grams" | "units" | "colors" | "assemblies";
  label: string;
  unit?: string;
  whole?: boolean;
};

const FIELDS: Field[] = [
  { name: "grams", label: "Filamento de la placa", unit: "g" },
  { name: "units", label: "Unidades por placa", whole: true },
  { name: "colors", label: "Colores", whole: true },
  { name: "assemblies", label: "Armados por unidad" },
];

/** El tiempo se escribe como lo dice el laminador; la fórmula usa su suma en minutos. */
const TIME_FIELDS: { name: "days" | "hours" | "minutes"; label: string; unit: string }[] = [
  { name: "days", label: "Días", unit: "d" },
  { name: "hours", label: "Horas", unit: "h" },
  { name: "minutes", label: "Minutos", unit: "min" },
];

function NumberField({
  id,
  label,
  unit,
  whole,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  unit?: string;
  whole?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {unit ? ` (${unit})` : ""}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode={whole ? "numeric" : "decimal"}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * El tiempo, en su propia fila y con los tres campos a la misma altura. La
 * unidad va **al lado** de cada campo, no encima: una etiqueta por campo
 * desalineaba la cuadrícula, y así los tres se leen de un tirón: «1 d 2 h 30 min».
 */
function TimeFields({
  baseId,
  state,
  minutes,
}: {
  baseId: string;
  state: PrintCostState;
  minutes: number;
}) {
  const { draft, errors } = state;
  const errorId = `${baseId}-time-error`;
  const error = TIME_FIELDS.map((field) => errors[field.name]).find(Boolean);

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">Tiempo de impresión</legend>
      <div className="flex max-w-md items-center gap-3">
        {TIME_FIELDS.map((field) => (
          <div key={field.name} className="flex min-w-0 flex-1 items-center gap-1.5">
            <Input
              id={`${baseId}-${field.name}`}
              type="text"
              inputMode="decimal"
              aria-label={field.label}
              value={draft[field.name]}
              aria-invalid={errors[field.name] ? true : undefined}
              aria-describedby={errors[field.name] ? errorId : undefined}
              onChange={(event) => state.setField(field.name, event.target.value)}
            />
            <span aria-hidden className="text-sm text-muted-foreground">
              {field.unit}
            </span>
          </div>
        ))}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        minutes > 0 && (
          <p className="text-sm text-muted-foreground" data-testid="print-cost-minutes">
            {minutesLabel(minutes)} de impresión
          </p>
        )
      )}
    </fieldset>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "font-medium" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function CalculatorForm({
  config,
  currency,
  state,
}: {
  config: PrintCostConfig;
  currency: string;
  state: PrintCostState;
}) {
  const baseId = useId();
  const { draft, errors, result, input, touched } = state;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <NumberField
              key={field.name}
              id={`${baseId}-${field.name}`}
              label={field.label}
              unit={field.unit}
              whole={field.whole}
              value={draft[field.name]}
              error={errors[field.name]}
              onChange={(value) => state.setField(field.name, value)}
            />
          ))}
        </div>

        <TimeFields baseId={baseId} state={state} minutes={input ? printMinutes(input) : 0} />

        {config.extras.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Insumos por unidad</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {config.extras.map((extra) => (
                <NumberField
                  key={extra.name}
                  id={`${baseId}-extra-${extra.name}`}
                  label={extra.name}
                  unit={`${money(extra.cost)} c/u`}
                  value={draft.extras[extra.name] ?? ""}
                  error={errors[`extras.${extra.name}`]}
                  onChange={(value) => state.setExtra(extra.name, value)}
                />
              ))}
            </div>
          </fieldset>
        )}

        <p className="text-sm text-muted-foreground" data-testid="print-cost-rates">
          Calculando con filamento a {money(config.filamentPricePerKg)} {currency} por kilo y
          máquina a {money(config.machineCostPerHour)} {currency} por hora.{" "}
          <Link href={PARAMS_HREF} className="underline underline-offset-2">
            Cambiar parámetros
          </Link>
        </p>
      </div>

      <div aria-live="polite" data-testid="print-cost-result">
        {!touched ? (
          <p className="text-sm text-muted-foreground">
            Escribe los gramos y el tiempo que indica tu laminador para ver el costo y los precios
            sugeridos.
          </p>
        ) : !result || !input ? (
          <p className="text-sm text-muted-foreground">
            Corrige los campos marcados para ver el resultado.
          </p>
        ) : (
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="mb-2 font-medium">Costo por unidad ({currency})</h3>
              <dl className="space-y-1">
                <Row label="Filamento de la placa" value={money(result.materialCost)} />
                <Row label="Máquina de la placa" value={money(result.machineCost)} />
                <Row
                  label={`Impresión por unidad (÷ ${input.units}${input.colors > 1 ? `, ${input.colors} colores` : ""})`}
                  value={money(result.printCostPerUnit)}
                />
                {result.assemblyCost > 0 && <Row label="Armado" value={money(result.assemblyCost)} />}
                {result.failureCost > 0 && (
                  <Row label="Fondo de fallos" value={money(result.failureCost)} />
                )}
                <div className="border-t pt-1">
                  <Row label="Costo de producción" value={money(result.unitCost)} strong />
                </div>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 font-medium">Precios sugeridos ({currency})</h3>
              <dl className="space-y-1">
                <Row label="Margen aplicado" value={marginPercent(result.margin)} />
                {result.extrasCost > 0 && (
                  <Row label="Insumos (sin margen)" value={money(result.extrasCost)} />
                )}
                <div className="border-t pt-1">
                  <Row label="Precio unitario" value={money(result.unitPrice)} strong />
                </div>
                <Row label="Precio por mayor" value={money(result.wholesalePrice)} />
                <Row label="Precio por docena" value={money(result.dozenPrice)} />
                {input.units > 1 && (
                  <Row
                    label={`Placa completa (${input.units} u.)`}
                    value={money(result.platePrice)}
                  />
                )}
              </dl>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** Lo que se ve cuando los parámetros guardados no sirven: no se calcula nada. */
export function InvalidConfigNotice() {
  return (
    <div role="alert" className="rounded-lg border p-4 text-sm" data-testid="print-cost-invalid">
      <p className="font-medium">Los parámetros de la calculadora necesitan revisión</p>
      <p className="mt-1 text-muted-foreground">
        Hay algún valor guardado que ya no es válido, así que no se calcula ningún precio hasta
        corregirlo.
      </p>
      <Link href={PARAMS_HREF} className="mt-2 inline-block underline underline-offset-2">
        Revisar parámetros
      </Link>
    </div>
  );
}
