import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecoveryBar } from "./recovery-bar";

afterEach(cleanup);

/**
 * Escenario del delta spec `assets`, requisito "Pantalla de activos (V12)":
 * "El recuperado se indica sin fiesta".
 */
describe("RecoveryBar", () => {
  it("escribe el porcentaje como texto, no solo como ancho", () => {
    render(<RecoveryBar totalCost={7000} marginSince={3500} label="Impresora 3D" />);

    expect(screen.getByTestId("recovery-bar")).toHaveAttribute("data-percent", "50");
    expect(screen.getByText("50 %")).toBeInTheDocument();
  });

  it("un activo recuperado lleva una marca discreta y nada más", () => {
    render(<RecoveryBar totalCost={7000} marginSince={9000} label="Impresora 3D" />);

    const mark = screen.getByTestId("recovered-mark");
    expect(mark).toHaveTextContent("Recuperado");
    // Sobrio: la marca es una línea de texto, no un cartel ni una felicitación.
    expect(screen.getByText("100 %")).toBeInTheDocument();
  });

  it("mientras no se ha recuperado no hay marca", () => {
    render(<RecoveryBar totalCost={7000} marginSince={6999} label="Impresora 3D" />);

    expect(screen.queryByTestId("recovered-mark")).not.toBeInTheDocument();
  });

  it("un margen negativo se dibuja como cero, no como una barra invertida", () => {
    render(<RecoveryBar totalCost={7000} marginSince={-800} label="Impresora 3D" />);

    expect(screen.getByTestId("recovery-bar")).toHaveAttribute("data-percent", "0");
  });
});
