import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  updateFairSettings: vi.fn(async () => undefined),
}));

import { updateFairSettings } from "@/actions/configuration";

import { FairAllLinesForm } from "./fair-all-lines-form";

/**
 * Escenarios del delta `org-configuration`: «Owner turns it on» y «The
 * explanation is shown with the toggle».
 */

afterEach(cleanup);

const TOGGLE = "Venta rápida con todas las líneas";

describe("FairAllLinesForm", () => {
  it("se muestra apagada con la explicación de a qué línea va cada venta", () => {
    render(<FairAllLinesForm allLines={false} />);

    expect(screen.getByRole("switch", { name: TOGGLE })).not.toBeChecked();
    expect(screen.getByTestId("fair-all-lines-notice")).toHaveTextContent(
      "cada producto se registra en su propia línea",
    );
    expect(screen.getByTestId("fair-all-lines-notice")).toHaveTextContent(
      "línea elegida al abrir la feria",
    );
  });

  it("Owner turns it on: encenderla y guardar llama a la acción", async () => {
    render(<FairAllLinesForm allLines={false} />);

    await userEvent.click(screen.getByRole("switch", { name: TOGGLE }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateFairSettings).toHaveBeenCalledWith({ allLines: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados.");
  });

  it("un error del servidor se muestra y no se confunde con éxito", async () => {
    vi.mocked(updateFairSettings).mockResolvedValueOnce({
      error: "No se pudo guardar la venta rápida. Intenta de nuevo.",
    });
    render(<FairAllLinesForm allLines />);

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
