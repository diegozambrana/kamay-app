import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { allocateSharedExpenses } from "@/lib/reports/allocation";

import { LineComparisonReport } from "./line-comparison-report";

const SUB = "line-sub";
const ALF = "line-alf";
const GEN = "line-gen";

const lineNames = new Map([
  [SUB, "Sublimación"],
  [ALF, "Alfarería"],
]);

function renderReport(sharedPaid: number) {
  const allocation = allocateSharedExpenses(
    [
      { businessLineId: SUB, isShared: false, collected: 3000, paid: 100 },
      { businessLineId: ALF, isShared: false, collected: 1000, paid: 200 },
      { businessLineId: GEN, isShared: true, collected: 0, paid: sharedPaid },
    ],
    { rule: "revenue" },
  );

  return render(
    <LineComparisonReport allocation={allocation} lineNames={lineNames} />,
  );
}

afterEach(cleanup);

describe("LineComparisonReport", () => {
  // Escenario «Leyenda en el comparativo». La leyenda llega en el mismo
  // objeto que las cifras, así que no se puede pintar una sin la otra.
  it("muestra la regla aplicada junto al resultado", () => {
    renderReport(400);

    expect(screen.getByTestId("allocation-legend")).toHaveTextContent(
      /proporcional a los ingresos/,
    );
    expect(screen.getByTestId("allocation-legend")).toHaveTextContent("75.0 %");
  });

  it("la línea compartida no aparece como fila propia", () => {
    renderReport(400);

    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.getByText("Sublimación")).toBeInTheDocument();
    expect(screen.getByText("Alfarería")).toBeInTheDocument();
  });

  it("los egresos de cada línea ya llevan su parte de General", () => {
    renderReport(400);

    // Sublimación: 100 propios + 300 repartidos = 400.
    expect(screen.getByRole("row", { name: /Sublimación/ })).toHaveTextContent(
      "400.00",
    );
  });

  it("advierte de que este informe ignora el selector de línea", () => {
    renderReport(400);

    expect(
      screen.getByText(/muestra siempre todas las líneas/),
    ).toBeInTheDocument();
  });

  it("un periodo sin gastos compartidos lo dice, no calla", () => {
    renderReport(0);

    expect(screen.getByTestId("allocation-legend")).toHaveTextContent(
      /No hubo gastos compartidos/,
    );
  });
});
