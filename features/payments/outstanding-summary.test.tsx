import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ALL_LINES, type OutstandingByLine } from "@/types";

import { OutstandingSummary, outstandingFor } from "./outstanding-summary";

const ORG = "11111111-1111-1111-1111-111111111111";
const SUBLIMACION = "22222222-2222-2222-2222-222222222222";
const ALFARERIA = "33333333-3333-3333-3333-333333333333";

function row(businessLineId: string, outstanding: number): OutstandingByLine {
  return { organizationId: ORG, businessLineId, outstanding };
}

afterEach(cleanup);

describe("outstandingFor", () => {
  it("Scenario: Filtro por línea de negocio — suma solo la línea activa", () => {
    const rows = [row(SUBLIMACION, 125), row(ALFARERIA, 40)];

    expect(outstandingFor(rows, SUBLIMACION)).toBe(125);
    expect(outstandingFor(rows, ALFARERIA)).toBe(40);
  });

  it("con todas las líneas suma el conjunto", () => {
    expect(outstandingFor([row(SUBLIMACION, 125), row(ALFARERIA, 40)], ALL_LINES)).toBe(
      165,
    );
  });

  it("Scenario: Ningún pedido pendiente — 0, no nulo", () => {
    expect(outstandingFor([row(SUBLIMACION, 0)], SUBLIMACION)).toBe(0);
  });

  it("una línea sin filas pendientes da cero, no indefinido", () => {
    expect(outstandingFor([row(SUBLIMACION, 125)], ALFARERIA)).toBe(0);
    expect(outstandingFor([], ALL_LINES)).toBe(0);
  });

  it("no vuelve a recortar los negativos: eso ya lo hizo la vista", () => {
    // Si la vista entregara un negativo, sumarlo tal cual delataría el fallo
    // en vez de esconderlo.
    expect(outstandingFor([row(SUBLIMACION, -50)], SUBLIMACION)).toBe(-50);
  });

  it("suma centavos sin arrastrar el error de coma flotante", () => {
    expect(outstandingFor([row(SUBLIMACION, 0.1), row(ALFARERIA, 0.2)], ALL_LINES)).toBe(
      0.3,
    );
  });
});

describe("OutstandingSummary", () => {
  it("muestra la etiqueta y el monto de la línea activa", () => {
    render(
      <OutstandingSummary
        label="Por cobrar"
        rows={[row(SUBLIMACION, 125), row(ALFARERIA, 40)]}
        activeLine={SUBLIMACION}
        testId="receivables"
      />,
    );

    expect(screen.getByTestId("receivables")).toHaveTextContent("Por cobrar");
    expect(screen.getByTestId("receivables")).toHaveTextContent("125.00");
  });

  it("Scenario: El ayudante no ve Por pagar — sin filas, muestra cero", () => {
    render(
      <OutstandingSummary
        label="Por pagar"
        rows={[]}
        activeLine={ALL_LINES}
        testId="payables"
      />,
    );

    expect(screen.getByTestId("payables")).toHaveTextContent("0.00");
  });
});
