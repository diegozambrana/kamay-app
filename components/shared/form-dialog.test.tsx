import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ConfirmResult } from "./confirm-dialog";
import { FormDialog, useEntityDialog } from "./form-dialog";

afterEach(cleanup);

type Item = { id: string; name: string };

function Harness({
  onSave,
}: {
  onSave: (values: { name: string; id: string | null }) => Promise<ConfirmResult>;
}) {
  const dialog = useEntityDialog<Item>();
  return (
    <>
      <Button onClick={dialog.openNew}>Nuevo canal</Button>
      <Button onClick={() => dialog.openEdit({ id: "c1", name: "Feria" })}>Editar Feria</Button>
      <FormDialog
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        title={dialog.target ? "Editar canal" : "Nuevo canal"}
        submitLabel={dialog.target ? "Guardar cambios" : "Crear canal"}
        pending={dialog.pending}
        error={dialog.error}
        onSubmit={(data) =>
          dialog.submit(() =>
            onSave({ name: String(data.get("name") ?? ""), id: dialog.target?.id ?? null }),
          )
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="channel-name">Nombre</Label>
          <Input id="channel-name" name="name" defaultValue={dialog.target?.name ?? ""} />
        </div>
      </FormDialog>
    </>
  );
}

describe("FormDialog", () => {
  it("enviar entrega los campos y cierra", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo canal" });
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Tienda");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear canal" }));

    expect(onSave).toHaveBeenCalledWith({ name: "Tienda", id: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("editar abre con los valores del registro", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Feria" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar canal" });
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Feria");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    expect(onSave).toHaveBeenCalledWith({ name: "Feria", id: "c1" });
  });

  // Spec `settings-interaction` → «Cancelling creates nothing», a nivel de componente.
  it("«Cancelar» cierra sin enviar y la próxima vez el formulario está vacío", async () => {
    const onSave = vi.fn(async () => undefined);
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    await userEvent.type(await screen.findByLabelText("Nombre"), "Borrador");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onSave).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    expect(await screen.findByLabelText("Nombre")).toHaveValue("");
  });

  // Spec `settings-interaction` → «Duplicate name», a nivel de componente.
  it("con error, sigue abierto con lo escrito y el mensaje dentro", async () => {
    const onSave = vi.fn(async () => ({ error: "Ya existe un canal con ese nombre." }));
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Feria");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear canal" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Ya existe un canal con ese nombre.",
    );
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("Feria");
  });

  it("mientras envía, el botón queda deshabilitado", async () => {
    let finish: () => void = () => {};
    const onSave = vi.fn(
      () => new Promise<undefined>((resolve) => (finish = () => resolve(undefined))),
    );
    render(<Harness onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Nuevo canal" }));
    await userEvent.type(await screen.findByLabelText("Nombre"), "Tienda");
    await userEvent.click(screen.getByRole("button", { name: "Crear canal" }));

    expect(screen.getByRole("button", { name: "Crear canal" })).toBeDisabled();
    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
