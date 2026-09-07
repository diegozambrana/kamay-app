import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LineCashFlow } from "@/lib/dashboard/indicators";

import { LineComparison } from "./line-comparison";

const SUBLIMACION = "22222222-2222-2222-2222-222222222222";
const TRES_D = "33333333-3333-3333-3333-333333333333";
const ALFARERIA = "44444444-4444-4444-4444-444444444444";

const rows: LineCashFlow[] = [
  {
    businessLineId: SUBLIMACION,
    name: "Sublimación",
    color: "blue",
    collected: 900,
    paid: 350,
  },
  { businessLineId: TRES_D, name: "3D", color: "violet", collected: 0, paid: 0 },
  {
    businessLineId: ALFARERIA,
    name: "Alfarería",
    color: "orange",
    collected: 120,
    paid: 500,
  },
];

afterEach(cleanup);

describe("LineComparison", () => {
  // Scenario: Una fila por línea
  it("muestra una fila por línea activa, con sus tres cifras", () => {
    render(
      <LineComparison rows={rows} activeLineId={null} monthLabel="febrero de 2026" />,
    );

    expect(screen.getByText("Sublimación")).toBeInTheDocument();
    expect(screen.getByText("3D")).toBeInTheDocument();
    expect(screen.getByText("Alfarería")).toBeInTheDocument();

    const sublimacion = screen.getByTestId(`comparison-row-${SUBLIMACION}`);
    expect(within(sublimacion).getByText("900.00")).toBeInTheDocument();
    expect(within(sublimacion).getByText("350.00")).toBeInTheDocument();
    // Margen: 900 − 350.
    expect(within(sublimacion).getByText("550.00")).toBeInTheDocument();
  });

  it("una línea con margen negativo lo muestra tal cual", () => {
    render(
      <LineComparison rows={rows} activeLineId={null} monthLabel="febrero de 2026" />,
    );

    const alfareria = screen.getByTestId(`comparison-row-${ALFARERIA}`);
    // 120 − 500 = −380. No se recorta a cero ni se esconde.
    expect(within(alfareria).getByText("-380.00")).toBeInTheDocument();
  });

  // Scenario: Las barras tienen lectura textual
  it("las cifras viven en una tabla y las barras no se anuncian", () => {
    const { container } = render(
      <LineComparison rows={rows} activeLineId={null} monthLabel="febrero de 2026" />,
    );

    // Una tabla de verdad: un lector de pantalla lee números, no anchos.
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: /Sublimación/ }),
    ).toBeInTheDocument();

    // Las barras son decorativas y quedan fuera del árbol accesible.
    const bars = container.querySelectorAll('span[style*="width"]');
    expect(bars.length).toBeGreaterThan(0);
    bars.forEach((bar) => expect(bar).toHaveAttribute("aria-hidden"));
  });

  it("destaca la línea activa sin sacar del comparativo a las demás", () => {
    render(
      <LineComparison
        rows={rows}
        activeLineId={ALFARERIA}
        monthLabel="febrero de 2026"
      />,
    );

    expect(screen.getByTestId(`comparison-row-${ALFARERIA}`)).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(
      screen.getByTestId(`comparison-row-${SUBLIMACION}`),
    ).not.toHaveAttribute("data-active");
    // Comparar es ver la elegida contra el resto: las tres siguen ahí.
    expect(screen.getAllByRole("rowheader")).toHaveLength(3);
  });

  it("la línea sin movimiento aparece con ceros, no desaparece", () => {
    render(
      <LineComparison rows={rows} activeLineId={null} monthLabel="febrero de 2026" />,
    );

    const tresD = screen.getByTestId(`comparison-row-${TRES_D}`);
    expect(within(tresD).getAllByText("0.00").length).toBeGreaterThan(0);
  });

  it("con todo en cero ninguna barra se llena", () => {
    const { container } = render(
      <LineComparison
        rows={rows.map((row) => ({ ...row, collected: 0, paid: 0 }))}
        activeLineId={null}
        monthLabel="febrero de 2026"
      />,
    );

    container
      .querySelectorAll('span[style*="width"]')
      .forEach((bar) => expect(bar.getAttribute("style")).toContain("0%"));
  });
});
