import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const back = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push: vi.fn(), replace: vi.fn() }),
}));

import { DiscardGuard } from "./discard-guard";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("DiscardGuard", () => {
  it("sin cambios sale directo, sin preguntar nada", async () => {
    const user = userEvent.setup();
    render(<DiscardGuard dirty={false} />);

    await user.click(screen.getByTestId("discard-button"));

    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
  });

  it("con cambios pide confirmación antes de salir", async () => {
    const user = userEvent.setup();
    render(<DiscardGuard dirty />);

    await user.click(screen.getByTestId("discard-button"));

    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
    // Todavía no se ha ido a ninguna parte.
    expect(back).not.toHaveBeenCalled();
  });

  it("rechazar la confirmación deja al usuario donde estaba", async () => {
    const user = userEvent.setup();
    render(<DiscardGuard dirty />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));

    expect(back).not.toHaveBeenCalled();
  });

  /** `back()` y no `push()`: volver conserva los filtros y la vista de origen. */
  it("aceptar la confirmación vuelve a la pantalla anterior", async () => {
    const user = userEvent.setup();
    render(<DiscardGuard dirty />);

    await user.click(screen.getByTestId("discard-button"));
    await user.click(screen.getByTestId("confirm-discard"));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it("tras guardar —cuando ya no hay cambios— la salida no pregunta", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DiscardGuard dirty />);

    // El formulario llama a `reset()` al guardar y `isDirty` vuelve a falso.
    rerender(<DiscardGuard dirty={false} />);
    await user.click(screen.getByTestId("discard-button"));

    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Descartar los cambios?")).toBeNull();
  });

  it("avisa también al recargar o cerrar la pestaña, y solo mientras haya cambios", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const { rerender } = render(<DiscardGuard dirty />);
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    rerender(<DiscardGuard dirty={false} />);
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    add.mockRestore();
    remove.mockRestore();
  });

  it("acepta un rótulo propio", () => {
    render(<DiscardGuard dirty={false} label="Descartar" />);

    expect(screen.getByTestId("discard-button")).toHaveTextContent("Descartar");
  });
});
