import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LOW_STOCK_PLACEHOLDER, PlaceholderCard } from "./placeholder-card";

afterEach(cleanup);

/**
 * KAM-17 · El marcador que sobrevive.
 *
 * Escenarios del delta spec `dashboard` — requisito "Marcador de posición de
 * insumos bajo mínimo": «El marcador que queda está rotulado» y «El marcador
 * no engaña».
 *
 * El de pendientes se retiró: su conducta la comprueba ahora
 * `pending-tasks-card.test.tsx`.
 */
describe("PlaceholderCard", () => {
  // Scenario: El marcador que queda está rotulado
  it("lleva su rótulo definitivo y su leyenda de no disponible", () => {
    render(<PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />);

    expect(screen.getByText("Insumos bajo mínimo")).toBeInTheDocument();
    expect(screen.getByText(/entradas y salidas/)).toBeInTheDocument();
  });

  // Scenario: El marcador no engaña
  it("no muestra ninguna cifra", () => {
    const { container } = render(<PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />);

    // Un cero de mentira en "Insumos bajo mínimo" se leería como "no falta
    // nada", que es justo lo contrario de lo que se sabe.
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("no ofrece ningún control ni enlace", () => {
    render(<PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("se puede reconocer como marcador desde fuera", () => {
    render(<PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />);

    expect(screen.getByTestId("placeholder-stock")).toHaveAttribute(
      "data-placeholder",
      "true",
    );
  });
});
