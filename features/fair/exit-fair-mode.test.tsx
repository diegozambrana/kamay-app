import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ExitFairMode } from "./exit-fair-mode";

afterEach(cleanup);

describe("ExitFairMode", () => {
  // Escenario: Salida explícita
  it("lleva al registro rápido", () => {
    render(<ExitFairMode />);

    expect(screen.getByTestId("fair-exit")).toHaveAttribute("href", "/quick");
  });

  it("dice explícitamente que se sale del modo feria", () => {
    render(<ExitFairMode />);

    expect(screen.getByText("Salir del modo feria")).toBeInTheDocument();
  });

  // Escenario: El control de salida no se confunde con el de cobro
  it("no se presenta como un botón de acción", () => {
    render(<ExitFairMode />);

    const salida = screen.getByTestId("fair-exit");
    // `Cobrar` y `Confirmar` son botones grandes y sólidos; este es discreto.
    expect(salida.className).toContain("text-muted-foreground");
    expect(salida.className).not.toContain("h-14");
  });
});
