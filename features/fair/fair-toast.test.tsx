import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FairToast } from "./fair-toast";

/**
 * El aviso de éxito tras registrar. Escenarios del delta `fair-mode`:
 * «Mensaje de éxito» y «Mensaje de éxito sin señal».
 */

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FairToast", () => {
  it("Mensaje de éxito: se anuncia sin robar el foco y desaparece solo", () => {
    render(<FairToast message={{ id: 1, text: "Venta registrada" }} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Venta registrada");
    // No tapa ni captura toques: la venta siguiente no espera.
    expect(status).toHaveClass("pointer-events-none");

    act(() => vi.advanceTimersByTime(2_500));

    expect(screen.queryByText("Venta registrada")).toBeNull();
  });

  it("un segundo mensaje reemplaza al primero y reinicia la cuenta", () => {
    const { rerender } = render(<FairToast message={{ id: 1, text: "Venta registrada" }} />);

    act(() => vi.advanceTimersByTime(2_000));
    rerender(
      <FairToast
        message={{ id: 2, text: "Venta guardada. Se enviará al recuperar la señal." }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Se enviará al recuperar la señal");

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("status")).toHaveTextContent("Se enviará al recuperar la señal");

    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText(/Se enviará/)).toBeNull();
  });

  it("sin mensaje no muestra nada", () => {
    render(<FairToast message={null} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
