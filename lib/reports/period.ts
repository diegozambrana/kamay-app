/**
 * El periodo de V14 · Reportes (KAM-20, design D1).
 *
 * Un solo rango gobierna los cinco informes: se resuelve una vez en el
 * servidor y se pasa igual a las cinco lecturas, que es lo que hace cierto el
 * criterio "las cifras cuadran entre ellos" por construcción y no por
 * coincidencia. Las fechas son civiles `YYYY-MM-DD` en la zona horaria de la
 * organización; convertirlas a instantes es trabajo de `startOfDayInTimezone`
 * y `startOfNextDayInTimezone`, que ya existen desde KAM-09 y no se duplican
 * aquí.
 */

import {
  type DateRange,
  currentMonthRange,
  isCivilDate,
  startOfDayInTimezone,
  startOfNextDayInTimezone,
} from "@/lib/expenses/period";

export type { DateRange };

/**
 * Los cinco atajos del selector. `custom` es el rango libre; el backlog pide
 * "atajos" sin enumerarlos y estos son los que el mapa §Recorridos ejercita
 * (V2 → V14 llega con "mes anterior") más el año que exige el presupuesto de
 * doce meses del criterio 8.
 */
export const PERIOD_PRESETS = [
  "this-month",
  "last-month",
  "last-3-months",
  "this-year",
  "custom",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const DEFAULT_PRESET: PeriodPreset = "this-month";

export type ReportPeriod = DateRange & {
  preset: PeriodPreset;
  /** Límite inferior inclusivo, como instante UTC. */
  fromInstant: string;
  /** Límite superior **exclusivo**: el inicio del día siguiente al último. */
  toInstant: string;
};

/** Un rango pedido que no se puede honrar. La pantalla lo dice y no recalcula. */
export class InvalidPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPeriodError";
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function civil(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Último día del mes indicado. El día 0 del siguiente es el último de este. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * El rango civil de un atajo, tomando `today` como el hoy de la organización.
 * `custom` no tiene rango propio: lo aportan `from` y `to`.
 */
export function rangeForPreset(preset: PeriodPreset, today: string): DateRange {
  const [year, month] = today.split("-").map(Number);

  switch (preset) {
    case "this-month":
      return currentMonthRange(today);

    case "last-month": {
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      return { from: civil(y, m, 1), to: civil(y, m, lastDayOfMonth(y, m)) };
    }

    // Tres meses **incluido el actual**: de aquí hasta el fin del mes en
    // curso. "Últimos 3 meses" que excluyera el actual dejaría fuera
    // justamente lo que se acaba de registrar.
    case "last-3-months": {
      const start = new Date(Date.UTC(year, month - 3, 1));
      return {
        from: civil(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
        to: currentMonthRange(today).to,
      };
    }

    case "this-year":
      return { from: civil(year, 1, 1), to: civil(year, 12, 31) };

    case "custom":
      return currentMonthRange(today);
  }
}

function isPreset(value: string | undefined): value is PeriodPreset {
  return (
    typeof value === "string" &&
    (PERIOD_PRESETS as readonly string[]).includes(value)
  );
}

/**
 * Resuelve el periodo pedido en la dirección. Un atajo desconocido cae en el
 * mes en curso; un `custom` cuyo rango falte o venga mal formado, también.
 *
 * Un rango invertido **no** se corrige en silencio: se lanza, porque quien lo
 * pidió tiene que enterarse de que no se aplicó (requisito *Un solo periodo
 * gobierna los cinco informes* → «Rango invertido»).
 */
export function resolveReportPeriod(
  params: { preset?: string; from?: string; to?: string },
  today: string,
  timeZone: string,
): ReportPeriod {
  const preset: PeriodPreset = isPreset(params.preset)
    ? params.preset
    : DEFAULT_PRESET;

  // El atajo efectivo puede no ser el pedido: un `custom` sin rango completo
  // no es un rango libre, es el mes en curso — y decir lo contrario dejaría al
  // selector marcando "rango libre" sobre fechas que nadie eligió.
  let effective: PeriodPreset = preset;
  let range: DateRange;

  if (preset === "custom" && isCivilDate(params.from) && isCivilDate(params.to)) {
    range = { from: params.from, to: params.to };
  } else {
    if (preset === "custom") effective = DEFAULT_PRESET;
    range = rangeForPreset(effective, today);
  }

  if (range.from > range.to) {
    throw new InvalidPeriodError(
      "El fin del periodo es anterior a su inicio; elige un rango válido.",
    );
  }

  return {
    ...range,
    preset: effective,
    fromInstant: startOfDayInTimezone(range.from, timeZone),
    toInstant: startOfNextDayInTimezone(range.to, timeZone),
  };
}
