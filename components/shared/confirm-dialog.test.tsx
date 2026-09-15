import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { type ConfirmResult, useConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

function Harness({ action }: { action: () => Promise<ConfirmResult> }) {
  const { ask, dialog } = useConfirmDialog();
  return (
    <>
      <Button
        onClick={() =>
          ask({
            title: "¿Archivar Sublimación?",
            description: "Deja de ofrecerse en los formularios nuevos.",
            confirmLabel: "Archivar",
            destructive: true,
            action,
          })
        }
      >
        Abrir
      </Button>
      {dialog}
    </>
  );
}

// Spec `settings-interaction` → «Every action that is not a form asks for confirmation».
describe("useConfirmDialog", () => {
  it("abrir no corre la acción: solo la describe", async () => {
    const action = vi.fn(async () => undefined);
    render(<Harness action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));

    const dialog = await screen.findByRole("alertdialog", { name: "¿Archivar Sublimación?" });
    expect(dialog).toHaveTextContent("Deja de ofrecerse en los formularios nuevos.");
    expect(action).not.toHaveBeenCalled();
  });

  it("«Cancelar» y Escape cierran sin llamarla", async () => {
    const action = vi.fn(async () => undefined);
    render(<Harness action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await screen.findByRole("alertdialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    expect(action).not.toHaveBeenCalled();
  });

  it("confirmar la llama una vez y cierra", async () => {
    const action = vi.fn(async () => undefined);
    render(<Harness action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await userEvent.click(await screen.findByRole("button", { name: "Archivar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("con error, el diálogo sigue abierto y lo muestra dentro", async () => {
    const action = vi.fn(async () => ({ error: "No se puede quitar al último dueño." }));
    render(<Harness action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await userEvent.click(await screen.findByRole("button", { name: "Archivar" }));

    const dialog = screen.getByRole("alertdialog");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se puede quitar al último dueño.",
    );
    expect(dialog).toContainElement(screen.getByRole("alert"));
  });

  it("mientras corre, los botones quedan deshabilitados", async () => {
    let finish: () => void = () => {};
    const action = vi.fn(
      () => new Promise<undefined>((resolve) => (finish = () => resolve(undefined))),
    );
    render(<Harness action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await userEvent.click(await screen.findByRole("button", { name: "Archivar" }));

    expect(screen.getByRole("button", { name: "Archivar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
