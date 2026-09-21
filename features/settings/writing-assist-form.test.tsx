import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/configuration", () => ({
  updateWritingAssistSettings: vi.fn(async () => undefined),
}));

import { updateWritingAssistSettings } from "@/actions/configuration";

import { WritingAssistForm } from "./writing-assist-form";

afterEach(cleanup);

describe("WritingAssistForm", () => {
  it("nace apagada por omisión y muestra el aviso del proveedor externo", () => {
    render(<WritingAssistForm enabled={false} />);

    expect(screen.getByLabelText("Activar la asistencia de redacción")).not.toBeChecked();
    expect(screen.getByTestId("writing-assist-notice")).toHaveTextContent(
      "sale hacia un proveedor externo",
    );
  });

  it("activarla y guardar llama a la acción con el valor nuevo", async () => {
    render(<WritingAssistForm enabled={false} />);

    await userEvent.click(screen.getByLabelText("Activar la asistencia de redacción"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateWritingAssistSettings).toHaveBeenCalledWith({ enabled: true });
    expect(await screen.findByRole("status")).toHaveTextContent("Cambios guardados.");
  });

  it("un error del servidor se muestra y no se confunde con éxito", async () => {
    vi.mocked(updateWritingAssistSettings).mockResolvedValueOnce({
      error: "No se pudo guardar la asistencia de redacción. Intenta de nuevo.",
    });

    render(<WritingAssistForm enabled={true} />);

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
