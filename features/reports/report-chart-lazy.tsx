"use client";

import dynamic from "next/dynamic";

import type { ChartDatum } from "./report-chart";

/**
 * La frontera de carga diferida del gráfico (KAM-20, design D7).
 *
 * Existe como componente propio porque `next/dynamic` con `ssr: false` **no
 * se puede usar dentro de un componente de servidor**, y dos de los informes
 * lo son. Poner aquí el `"use client"` deja que cualquier informe —de
 * servidor o de cliente— pida el gráfico sin cambiar de naturaleza por ello.
 *
 * El gráfico sigue fuera del camino crítico: la tabla es la fuente y se pinta
 * sin esperarlo.
 */
const ReportChartImpl = dynamic(
  () => import("./report-chart").then((m) => m.ReportChart),
  { ssr: false },
);

export function ReportChart(props: { data: ChartDatum[]; ariaLabel: string }) {
  return <ReportChartImpl {...props} />;
}
