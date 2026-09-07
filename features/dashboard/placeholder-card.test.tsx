import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  LOW_STOCK_PLACEHOLDER,
  PENDING_TASKS_PLACEHOLDER,
  PlaceholderCard,
} from "./placeholder-card";

afterEach(cleanup);

describe("PlaceholderCard", () => {
  // Scenario: Los dos marcadores están rotulados
  it("los dos marcadores llevan su rótulo definitivo y su leyenda", () => {
    render(
      <>
        <PlaceholderCard {...PENDING_TASKS_PLACEHOLDER} />
        <PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />
      </>,
    );

    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    expect(screen.getByText("Insumos bajo mínimo")).toBeInTheDocument();
    expect(screen.getByText(/módulo de tareas/)).toBeInTheDocument();
    expect(screen.getByText(/entradas y salidas/)).toBeInTheDocument();
  });

  // Scenario: El marcador no engaña
  it("no muestra ninguna cifra", () => {
    const { container } = render(
      <>
        <PlaceholderCard {...PENDING_TASKS_PLACEHOLDER} />
        <PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />
      </>,
    );

    // Ni un importe ni un contador: un cero de mentira en "Insumos bajo
    // mínimo" se leería como "no falta nada".
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("no ofrece ningún control ni enlace", () => {
    render(<PlaceholderCard {...LOW_STOCK_PLACEHOLDER} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("se puede reconocer como marcador desde fuera", () => {
    render(<PlaceholderCard {...PENDING_TASKS_PLACEHOLDER} />);

    expect(screen.getByTestId("placeholder-tasks")).toHaveAttribute(
      "data-placeholder",
      "true",
    );
  });
});
