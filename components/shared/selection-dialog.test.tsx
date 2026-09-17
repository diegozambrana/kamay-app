import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { SelectionDialog } from "./selection-dialog";

afterEach(cleanup);

type Row = { id: string; name: string };

const ROWS: Row[] = [
  { id: "a", name: "Taza blanca" },
  { id: "b", name: "Maceta de barro" },
  { id: "c", name: "Llavero" },
];

function Harness({
  onConfirm,
  initialSelected,
}: {
  onConfirm: (keys: string[]) => void;
  initialSelected?: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <SelectionDialog
        open={open}
        onOpenChange={setOpen}
        title="Agregar del catálogo"
        items={ROWS}
        getKey={(row) => row.id}
        getSearchText={(row) => row.name}
        renderItem={(row) => row.name}
        mode="multiple"
        label="Productos"
        initialSelected={initialSelected}
        confirmLabel={(count) => (count > 0 ? `Agregar (${count})` : "Agregar")}
        onConfirm={onConfirm}
      />
    </>
  );
}

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
  return screen.findByRole("dialog", { name: "Agregar del catálogo" });
}

describe("SelectionDialog", () => {
  it("confirmar está deshabilitado sin selección", async () => {
    render(<Harness onConfirm={vi.fn()} />);
    const dialog = await openDialog();

    expect(within(dialog).getByRole("button", { name: "Agregar" })).toBeDisabled();
  });

  it("confirmar entrega las claves en el orden de la lista y cierra", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("option", { name: "Llavero" }));
    await userEvent.click(within(dialog).getByRole("option", { name: "Taza blanca" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar (2)" }));

    expect(onConfirm).toHaveBeenCalledWith(["a", "c"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it.each([
    ["Cancelar", async (dialog: HTMLElement) =>
      userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))],
    ["Esc", async () => userEvent.keyboard("{Escape}")],
  ])("%s no confirma y al reabrir no hay nada marcado", async (_, close) => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    let dialog = await openDialog();

    await userEvent.click(within(dialog).getByRole("option", { name: "Llavero" }));
    await close(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();

    dialog = await openDialog();
    expect(within(dialog).getByRole("option", { name: "Llavero" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(within(dialog).getByRole("button", { name: "Agregar" })).toBeDisabled();
  });

  it("lo inicial llega marcado", async () => {
    render(<Harness onConfirm={vi.fn()} initialSelected={["b"]} />);
    const dialog = await openDialog();

    expect(
      within(dialog).getByRole("option", { name: "Maceta de barro" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByRole("button", { name: "Agregar (1)" })).toBeEnabled();
  });
});
