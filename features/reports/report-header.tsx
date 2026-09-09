"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PeriodPreset } from "@/lib/reports/period";
import { ALL_LINES, type ActiveLine, type BusinessLine } from "@/types";

const PRESET_LABELS: { value: PeriodPreset; label: string }[] = [
  { value: "this-month", label: "Este mes" },
  { value: "last-month", label: "Mes anterior" },
  { value: "last-3-months", label: "Últimos 3 meses" },
  { value: "this-year", label: "Este año" },
  { value: "custom", label: "Rango libre" },
];

/**
 * Los dos selectores de V14 (KAM-20, design D1 y D9).
 *
 * Ambos escriben en la **dirección**, no en un store: es lo que hace la
 * pantalla enlazable —compartir el enlace reproduce el mismo recorte— y lo que
 * garantiza que los cinco informes se recalculen juntos, porque el periodo lo
 * resuelve el servidor una sola vez al volver a rendir.
 *
 * El selector de línea **no** toca la cookie de línea activa: cambiar de línea
 * en un informe no debe reordenar el tablero de pedidos al volver.
 */
export function ReportHeader({
  lines,
  preset,
  from,
  to,
  line,
}: {
  lines: BusinessLine[];
  preset: PeriodPreset;
  from: string;
  to: string;
  line: ActiveLine;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const push = useCallback(
    (next: Record<string, string | null>) => {
      const query = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null) query.delete(key);
        else query.set(key, value);
      }
      router.push(`${pathname}?${query.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="preset">Periodo</Label>
        <Select
          value={preset}
          onValueChange={(value) =>
            push(
              value === "custom"
                ? { preset: value, from, to }
                : { preset: value, from: null, to: null },
            )
          }
        >
          <SelectTrigger id="preset" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_LABELS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="from">Desde</Label>
            <Input
              id="from"
              type="date"
              defaultValue={from}
              onChange={(event) =>
                event.target.value &&
                push({ preset: "custom", from: event.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Hasta</Label>
            <Input
              id="to"
              type="date"
              defaultValue={to}
              onChange={(event) =>
                event.target.value &&
                push({ preset: "custom", to: event.target.value })
              }
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="line">Línea</Label>
        <Select value={line} onValueChange={(value) => push({ line: value })}>
          <SelectTrigger id="line" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LINES}>Todas</SelectItem>
            {lines.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
