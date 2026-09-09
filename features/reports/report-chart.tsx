"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * El gráfico de lectura de un informe (KAM-20, design D7).
 *
 * **La tabla es la fuente; el gráfico la ilustra.** Se carga con
 * `next/dynamic` sin SSR desde quien lo usa, así que un informe cuyo gráfico
 * no llegue sigue siendo legible y ordenable — y esa es también la lectura
 * accesible, sin necesidad de una versión aparte.
 *
 * Se dibuja con el componente `chart` de shadcn/ui, que es el registro que el
 * proyecto ya usa: se tematiza con las mismas variables CSS que el resto de la
 * interfaz, modo oscuro incluido, sin un segundo vocabulario de color.
 */
export type ChartDatum = {
  label: string;
  value: number;
};

const config = {
  value: { label: "Importe", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function ReportChart({
  data,
  ariaLabel,
}: {
  data: ChartDatum[];
  ariaLabel: string;
}) {
  if (data.length === 0) return null;

  return (
    <ChartContainer
      config={config}
      className="h-48 w-full"
      // El gráfico no aporta información que la tabla no tenga: se anuncia
      // como imagen con su rótulo y se deja que la tabla haga el trabajo.
      role="img"
      aria-label={ariaLabel}
    >
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis tickLine={false} axisLine={false} width={56} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
